import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { logAudit } from "../middleware/audit";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email.service";
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
    tenantId: string;
    tenantSlug: string;
  };
}

function generateTokens(userId: string, role: Role, tenantId: string): TokenPair {
  const accessToken = jwt.sign({ userId, role, tenantId }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });
  const refreshToken = jwt.sign({ userId, tenantId, type: "refresh" }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  });
  return { accessToken, refreshToken };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function signup(
  input: SignupInput,
  meta: { ip?: string; userAgent?: string }
): Promise<AuthResult> {
  const email = input.email.toLowerCase();

  let baseSlug = slugify(input.orgName || `${input.firstName}-${input.lastName}`);
  let slug = baseSlug;
  let attempt = 0;
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  const passwordHash = await bcrypt.hash(input.password, env.bcryptRounds);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug,
        name: input.orgName || `${input.firstName} ${input.lastName}`,
        plan: "FREE",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    const existing = await tx.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });
    if (existing) {
      throw new AppError("E-mail já cadastrado.", 409);
    }

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash,
        role: Role.OWNER,
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

    return { user, tenant };
  });

  const tokens = generateTokens(result.user.id, result.user.role, result.tenant.id);

  await prisma.session.create({
    data: {
      userId: result.user.id,
      refreshToken: tokens.refreshToken,
      userAgent: meta.userAgent?.slice(0, 500),
      ipAddress: meta.ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await logAudit({
    userId: result.user.id,
    action: "auth.signup",
    entity: "tenant",
    entityId: result.tenant.id,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  if (env.resendApiKey && result.user.emailVerifyToken) {
    sendVerificationEmail(
      result.user.email,
      result.user.profile!.firstName,
      result.user.emailVerifyToken
    ).catch(() => {});
  }

  return {
    tokens,
    user: {
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      firstName: result.user.profile!.firstName,
      lastName: result.user.profile!.lastName,
      tenantId: result.tenant.id,
      tenantSlug: result.tenant.slug,
    },
  };
}

export async function login(
  input: LoginInput,
  meta: { ip?: string; userAgent?: string }
): Promise<AuthResult> {
  const email = input.email.toLowerCase();

  const user = await prisma.user.findFirst({
    where: { email, tenant: { slug: input.tenantSlug } },
    include: { profile: true, tenant: { select: { id: true, slug: true, active: true } } },
  });

  if (!user) {
    throw new AppError("Credenciais inválidas.", 401);
  }

  if (!user.tenant.active) {
    throw new AppError("Organização inativa. Entre em contato com o suporte.", 403);
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

  const tokens = generateTokens(user.id, user.role, user.tenantId);

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
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
    },
  };
}

export async function refreshAccessToken(
  refreshToken: string,
  meta: { ip?: string; userAgent?: string }
): Promise<TokenPair> {
  let payload: { userId: string; tenantId: string };
  try {
    payload = jwt.verify(refreshToken, env.jwtRefreshSecret) as { userId: string; tenantId: string };
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

  const newTokens = generateTokens(user.id, user.role, user.tenantId);

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

export async function forgotPassword(email: string, tenantSlug: string, meta: { ip?: string }) {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), tenant: { slug: tenantSlug } },
  });
  if (!user) return;

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

  if (env.resendApiKey) {
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    sendPasswordResetEmail(
      user.email,
      profile?.firstName || "Usuário",
      token
    ).catch(() => {});
  }
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

export async function verifyEmail(token: string) {
  const user = await prisma.user.findFirst({
    where: { emailVerifyToken: token },
  });

  if (!user) {
    throw new AppError("Token de verificação inválido ou já utilizado.", 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifyToken: null,
    },
  });

  await logAudit({ userId: user.id, action: "auth.verify_email" });
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      tenantId: true,
      emailVerified: true,
      createdAt: true,
      tenant: {
        select: {
          slug: true,
          name: true,
          logoUrl: true,
          primaryColor: true,
          accentColor: true,
          plan: true,
        },
      },
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
