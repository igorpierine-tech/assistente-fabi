import { prisma } from "../config/prisma";
import { AppError } from "./auth.service";
import type {
  CreatePlanInput,
  UpdatePlanInput,
  SetPlanContentsInput,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from "../schemas/plan";

// ─── PLANS CRUD ─────────────────────────────────────────────────────────────

export async function listPlans(tenantId: string, onlyActive = false) {
  return prisma.plan.findMany({
    where: { tenantId, ...(onlyActive ? { active: true } : {}) },
    include: {
      contents: {
        include: {
          program: { select: { id: true, title: true, slug: true } },
          module: { select: { id: true, title: true, slug: true } },
          lesson: { select: { id: true, title: true, slug: true } },
        },
      },
      _count: { select: { subscriptions: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getPlan(tenantId: string, planId: string) {
  const plan = await prisma.plan.findFirst({
    where: { id: planId, tenantId },
    include: {
      contents: {
        include: {
          program: { select: { id: true, title: true, slug: true } },
          module: { select: { id: true, title: true, slug: true } },
          lesson: { select: { id: true, title: true, slug: true } },
        },
      },
      subscriptions: {
        include: {
          user: {
            select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!plan) throw new AppError("Plano não encontrado.", 404);
  return plan;
}

export async function createPlan(tenantId: string, data: CreatePlanInput) {
  const existing = await prisma.plan.findUnique({
    where: { tenantId_slug: { tenantId, slug: data.slug } },
  });
  if (existing) throw new AppError("Já existe um plano com este slug.", 409);

  return prisma.plan.create({
    data: { ...data, tenantId },
  });
}

export async function updatePlan(tenantId: string, planId: string, data: UpdatePlanInput) {
  const plan = await prisma.plan.findFirst({ where: { id: planId, tenantId } });
  if (!plan) throw new AppError("Plano não encontrado.", 404);

  if (data.slug && data.slug !== plan.slug) {
    const existing = await prisma.plan.findUnique({
      where: { tenantId_slug: { tenantId, slug: data.slug } },
    });
    if (existing) throw new AppError("Já existe um plano com este slug.", 409);
  }

  return prisma.plan.update({ where: { id: planId }, data });
}

export async function deletePlan(tenantId: string, planId: string) {
  const plan = await prisma.plan.findFirst({ where: { id: planId, tenantId } });
  if (!plan) throw new AppError("Plano não encontrado.", 404);

  const activeSubscriptions = await prisma.subscription.count({
    where: { planId, status: "ACTIVE" },
  });
  if (activeSubscriptions > 0) {
    throw new AppError("Não é possível excluir um plano com assinaturas ativas.", 400);
  }

  return prisma.plan.delete({ where: { id: planId } });
}

// ─── PLAN CONTENTS ──────────────────────────────────────────────────────────

export async function setPlanContents(tenantId: string, planId: string, data: SetPlanContentsInput) {
  const plan = await prisma.plan.findFirst({ where: { id: planId, tenantId } });
  if (!plan) throw new AppError("Plano não encontrado.", 404);

  const contentRecords = [
    ...data.programIds.map((programId) => ({ planId, programId })),
    ...data.moduleIds.map((moduleId) => ({ planId, moduleId })),
    ...data.lessonIds.map((lessonId) => ({ planId, lessonId })),
  ];

  await prisma.$transaction([
    prisma.planContent.deleteMany({ where: { planId } }),
    ...(contentRecords.length > 0
      ? [prisma.planContent.createMany({ data: contentRecords })]
      : []),
  ]);

  return getPlan(tenantId, planId);
}

// ─── SUBSCRIPTIONS ──────────────────────────────────────────────────────────

export async function listSubscriptions(tenantId: string, planId?: string) {
  return prisma.subscription.findMany({
    where: {
      plan: { tenantId },
      ...(planId ? { planId } : {}),
    },
    include: {
      user: {
        select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } },
      },
      plan: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createSubscription(tenantId: string, data: CreateSubscriptionInput) {
  const plan = await prisma.plan.findFirst({ where: { id: data.planId, tenantId } });
  if (!plan) throw new AppError("Plano não encontrado.", 404);

  const user = await prisma.user.findFirst({ where: { id: data.userId, tenantId } });
  if (!user) throw new AppError("Usuário não encontrado.", 404);

  const existing = await prisma.subscription.findFirst({
    where: { userId: data.userId, planId: data.planId, status: "ACTIVE" },
  });
  if (existing) throw new AppError("Usuário já possui assinatura ativa neste plano.", 409);

  const subscription = await prisma.subscription.create({
    data: {
      userId: data.userId,
      planId: data.planId,
      startsAt: data.startsAt ?? new Date(),
      expiresAt: data.expiresAt,
      externalId: data.externalId,
    },
  });

  const planContents = await prisma.planContent.findMany({
    where: { planId: data.planId, programId: { not: null } },
    select: { programId: true },
  });

  for (const pc of planContents) {
    if (!pc.programId) continue;
    await prisma.enrollment.upsert({
      where: { userId_programId: { userId: data.userId, programId: pc.programId } },
      create: { userId: data.userId, programId: pc.programId },
      update: {},
    });
  }

  return subscription;
}

export async function updateSubscription(subscriptionId: string, tenantId: string, data: UpdateSubscriptionInput) {
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, plan: { tenantId } },
  });
  if (!subscription) throw new AppError("Assinatura não encontrada.", 404);

  return prisma.subscription.update({
    where: { id: subscriptionId },
    data,
  });
}

// ─── ENTITLEMENT CHECK ──────────────────────────────────────────────────────

export async function checkEntitlement(
  userId: string,
  content: { programId?: string; moduleId?: string; lessonId?: string }
): Promise<boolean> {
  const activeSubs = await prisma.subscription.findMany({
    where: {
      userId,
      status: "ACTIVE",
      startsAt: { lte: new Date() },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { planId: true },
  });

  if (activeSubs.length === 0) return false;

  const planIds = activeSubs.map((s) => s.planId);

  if (content.programId) {
    const match = await prisma.planContent.findFirst({
      where: { planId: { in: planIds }, programId: content.programId },
    });
    if (match) return true;
  }

  if (content.moduleId) {
    const match = await prisma.planContent.findFirst({
      where: { planId: { in: planIds }, moduleId: content.moduleId },
    });
    if (match) return true;

    const mod = await prisma.module.findUnique({
      where: { id: content.moduleId },
      select: { programId: true },
    });
    if (mod) {
      const programMatch = await prisma.planContent.findFirst({
        where: { planId: { in: planIds }, programId: mod.programId },
      });
      if (programMatch) return true;
    }
  }

  if (content.lessonId) {
    const match = await prisma.planContent.findFirst({
      where: { planId: { in: planIds }, lessonId: content.lessonId },
    });
    if (match) return true;

    const lesson = await prisma.lesson.findUnique({
      where: { id: content.lessonId },
      select: { moduleId: true, module: { select: { programId: true } } },
    });
    if (lesson) {
      const moduleMatch = await prisma.planContent.findFirst({
        where: { planId: { in: planIds }, moduleId: lesson.moduleId },
      });
      if (moduleMatch) return true;

      const programMatch = await prisma.planContent.findFirst({
        where: { planId: { in: planIds }, programId: lesson.module.programId },
      });
      if (programMatch) return true;
    }
  }

  return false;
}
