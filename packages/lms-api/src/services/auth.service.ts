import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { logAudit } from "../middleware/audit";
import type { SignupInput, LoginInput } from "../schemas/auth";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult {
  tokens: TokenPair;
  user: {
    id: string;
    email: string;
    role: Role;
    firstName: string;
    lastName: string;
  };
}

function generateTokens(userId: string, role: Role): TokenPair {
  const accessToken = jwt.sign({ userId, role }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });
  const refreshToken = jwt.sign({ userId, type: "refresh" }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  });
  return { accessToken, refreshToken };
}

export async function signup(
  input: SignupInput,
  meta: { ip?: string; userAgent?: string }
): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) {
    throw new AppError("E-mail já cadastrado.", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, env.bcryptRounds);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash,
      role: Role.STUDENT,
      emailVerifyToken: randomBytes(32).toString("hex"),
      profile: {
        create: {
          firstName: input.firstName,
          lastName: input.lastName,
          lgpdConsentAt: new Date(),
          lgpdConsentVersion: "1.0",
        },
      },
    },
    include: { profile: true },
  });

  const tokens = generateTokens(user.id, user.role);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: tokens.refreshToken,
      userAgent: meta.userAgent?.slice(0, 500),
      ipAddress: meta.ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await logAudit({
    userId: user.id,
    action: "auth.signup",
    entity: "user",
    entityId: user.id,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    tokens,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.profile!.firstName,
      lastName: user.profile!.lastName,
    },
  };
}

export async function login(
  input: LoginInput,
  meta: { ip?: string; userAgent?: string }
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: { profile: true },
  });

  if (!user) {
    throw new AppError("Credenciais inválidas.", 401);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new AppError(
      `Conta temporariamente bloqueada. Tente novamente em ${minutesLeft} minuto(s).`,
      423
    );
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const lockout =
      attempts >= env.maxLoginAttempts
        ? new Date(Date.now() + env.lockoutDurationMs)
        : null;

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: attempts, lockedUntil: lockout },
    });

    await logAudit({
      userId: user.id,
      action: "auth.login_failed",
      metadata: { attempts },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    throw new AppError("Credenciais inválidas.", 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  const tokens = generateTokens(user.id, user.role);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: tokens.refreshToken,
      userAgent: meta.userAgent?.slice(0, 500),
      ipAddress: meta.ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await logAudit({
    userId: user.id,
    action: "auth.login",
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    tokens,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.profile?.firstName || "",
      lastName: user.profile?.lastName || "",
    },
  };
}

export async function refreshAccessToken(
  refreshToken: string,
  meta: { ip?: string; userAgent?: string }
): Promise<TokenPair> {
  let payload: { userId: string };
  try {
    payload = jwt.verify(refreshToken, env.jwtRefreshSecret) as { userId: string };
  } catch {
    throw new AppError("Refresh token inválido ou expirado.", 401);
  }

  const session = await prisma.session.findUnique({ where: { refreshToken } });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    throw new AppError("Sessão expirada. Faça login novamente.", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    throw new AppError("Usuário não encontrado.", 401);
  }

  const newTokens = generateTokens(user.id, user.role);

  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshToken: newTokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: meta.userAgent?.slice(0, 500),
      ipAddress: meta.ip,
    },
  });

  return newTokens;
}

export async function logout(refreshToken: string, userId: string) {
  await prisma.session.deleteMany({
    where: { refreshToken, userId },
  });
  await logAudit({ userId, action: "auth.logout" });
}

export async function forgotPassword(email: string, meta: { ip?: string }) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return; // silent — don't reveal user existence

  const token = randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: token,
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  await logAudit({
    userId: user.id,
    action: "auth.forgot_password",
    ipAddress: meta.ip,
  });

  // TODO: send email with reset link containing the token
}

export async function resetPassword(token: string, newPassword: string, meta: { ip?: string }) {
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: { gt: new Date() },
    },
  });

  if (!user) {
    throw new AppError("Token de recuperação inválido ou expirado.", 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);

  await logAudit({
    userId: user.id,
    action: "auth.reset_password",
    ipAddress: meta.ip,
  });
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          avatarUrl: true,
          phone: true,
          company: true,
          jobTitle: true,
          bio: true,
        },
      },
    },
  });

  if (!user) throw new AppError("Usuário não encontrado.", 404);
  return user;
}

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AppError";
  }
}
