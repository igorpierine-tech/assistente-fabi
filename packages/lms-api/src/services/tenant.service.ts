import { prisma } from "../config/prisma";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { AppError } from "./auth.service";

export async function getTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      accentColor: true,
      customDomain: true,
      plan: true,
      maxStudents: true,
      maxPrograms: true,
      maxStorageMb: true,
      trialEndsAt: true,
      createdAt: true,
      _count: {
        select: {
          users: true,
          programs: true,
        },
      },
    },
  });

  if (!tenant) throw new AppError("Organização não encontrada.", 404);
  return tenant;
}

export async function updateTenant(
  tenantId: string,
  data: {
    name?: string;
    logoUrl?: string;
    primaryColor?: string;
    accentColor?: string;
  }
) {
  return prisma.tenant.update({
    where: { id: tenantId },
    data,
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      accentColor: true,
    },
  });
}

export async function listMembers(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId },
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
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function inviteMember(
  tenantId: string,
  data: { email: string; firstName: string; lastName: string; role: Role }
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { maxStudents: true, _count: { select: { users: true } } },
  });

  if (!tenant) throw new AppError("Organização não encontrada.", 404);

  if (tenant._count.users >= tenant.maxStudents) {
    throw new AppError(
      `Limite de ${tenant.maxStudents} membros atingido. Faça upgrade do plano.`,
      403
    );
  }

  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email: data.email.toLowerCase() } },
  });
  if (existing) {
    throw new AppError("Este e-mail já está cadastrado nesta organização.", 409);
  }

  const tempPassword = `Temp@${Math.random().toString(36).slice(2, 10)}`;
  const passwordHash = await bcrypt.hash(tempPassword, env.bcryptRounds);

  const user = await prisma.user.create({
    data: {
      tenantId,
      email: data.email.toLowerCase(),
      passwordHash,
      role: data.role,
      profile: {
        create: {
          firstName: data.firstName,
          lastName: data.lastName,
          lgpdConsentAt: new Date(),
          lgpdConsentVersion: "1.0",
        },
      },
    },
    select: { id: true, email: true, role: true },
  });

  // TODO: send invitation email with temp password or magic link
  return user;
}

export async function removeMember(tenantId: string, userId: string, requesterId: string) {
  if (userId === requesterId) {
    throw new AppError("Você não pode remover a si mesmo.", 400);
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  });

  if (!user) throw new AppError("Membro não encontrado.", 404);
  if (user.role === Role.OWNER) throw new AppError("Não é possível remover o proprietário.", 403);

  await prisma.user.delete({ where: { id: userId } });
}

export async function updateMemberRole(
  tenantId: string,
  userId: string,
  newRole: Role,
  requesterId: string
) {
  if (userId === requesterId) {
    throw new AppError("Você não pode alterar sua própria role.", 400);
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  });

  if (!user) throw new AppError("Membro não encontrado.", 404);
  if (user.role === Role.OWNER) throw new AppError("Não é possível alterar a role do proprietário.", 403);

  return prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
    select: { id: true, email: true, role: true },
  });
}
