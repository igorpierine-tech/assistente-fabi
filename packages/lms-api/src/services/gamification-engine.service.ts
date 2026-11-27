import { prisma } from "../config/prisma";
import { AppError } from "./auth.service";

type GamificationEvent =
  | "LESSON_COMPLETED"
  | "LIVE_SESSION_ATTENDED"
  | "ASSESSMENT_SUBMITTED"
  | "STREAK_MILESTONE"
  | "PROGRAM_COMPLETED"
  | "MODULE_COMPLETED"
  | "ENROLLMENT_CREATED";

type LeadershipTier = "GESTORA_AUREA" | "LIDER_ESTRATEGICA" | "EXECUTIVA_ALTO_IMPACTO";

interface EventPayload {
  userId: string;
  tenantId: string;
  event: GamificationEvent;
  referenceId: string;
  referenceType: string;
}

const TIER_THRESHOLDS: { tier: LeadershipTier; minXp: number }[] = [
  { tier: "EXECUTIVA_ALTO_IMPACTO", minXp: 5000 },
  { tier: "LIDER_ESTRATEGICA", minXp: 2000 },
  { tier: "GESTORA_AUREA", minXp: 0 },
];

function computeTier(totalXp: number): LeadershipTier {
  for (const t of TIER_THRESHOLDS) {
    if (totalXp >= t.minXp) return t.tier;
  }
  return "GESTORA_AUREA";
}

// ─── Event Processor ────────────────────────────────────────────────────────

export async function processEvent(payload: EventPayload): Promise<{ xpAwarded: number; badgesAwarded: string[] }> {
  const { userId, tenantId, event, referenceId, referenceType } = payload;

  const rules = await prisma.gamificationRule.findMany({
    where: { tenantId, event, active: true },
    include: { badge: true },
  });

  let totalXpAwarded = 0;
  const badgesAwarded: string[] = [];

  for (const rule of rules) {
    if (rule.conditions) {
      const conditionsMet = evaluateConditions(rule.conditions as Record<string, unknown>, payload);
      if (!conditionsMet) continue;
    }

    try {
      await prisma.pointLedger.create({
        data: {
          userId,
          ruleId: rule.id,
          points: rule.xpReward,
          reason: rule.name,
          referenceType,
          referenceId,
        },
      });
      totalXpAwarded += rule.xpReward;
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr.code === "P2002") continue;
      throw err;
    }

    if (rule.badge) {
      const alreadyHas = await prisma.userBadge.findUnique({
        where: { userId_badgeId: { userId, badgeId: rule.badge.id } },
      });
      if (!alreadyHas) {
        await prisma.userBadge.create({
          data: { userId, badgeId: rule.badge.id },
        });
        badgesAwarded.push(rule.badge.id);
      }
    }
  }

  if (totalXpAwarded > 0) {
    await updateProfile(userId, totalXpAwarded);
  }

  return { xpAwarded: totalXpAwarded, badgesAwarded };
}

function evaluateConditions(conditions: Record<string, unknown>, _payload: EventPayload): boolean {
  if (conditions.minScore !== undefined) return true;
  return true;
}

// ─── Profile Management ─────────────────────────────────────────────────────

async function updateProfile(userId: string, xpDelta: number) {
  const profile = await prisma.gamificationProfile.upsert({
    where: { userId },
    create: {
      userId,
      totalXp: xpDelta,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityAt: new Date(),
    },
    update: {
      totalXp: { increment: xpDelta },
      lastActivityAt: new Date(),
    },
  });

  const lastActivity = profile.lastActivityAt;
  const now = new Date();
  let newStreak = profile.currentStreak;

  if (lastActivity) {
    const diffMs = now.getTime() - lastActivity.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays >= 1 && diffDays < 2) {
      newStreak = profile.currentStreak + 1;
    } else if (diffDays >= 2) {
      newStreak = 1;
    }
  }

  const newTier = computeTier(profile.totalXp);
  const longestStreak = Math.max(profile.longestStreak, newStreak);

  if (newStreak !== profile.currentStreak || newTier !== profile.currentTier || longestStreak !== profile.longestStreak) {
    await prisma.gamificationProfile.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak,
        currentTier: newTier,
      },
    });
  }
}

export async function getProfile(userId: string) {
  const profile = await prisma.gamificationProfile.findUnique({ where: { userId } });
  if (!profile) {
    return prisma.gamificationProfile.create({
      data: { userId, totalXp: 0 },
    });
  }
  return profile;
}

// ─── Streak Check ───────────────────────────────────────────────────────────

export async function updateStreak(userId: string, tenantId: string) {
  const profile = await getProfile(userId);
  const milestones = [7, 14, 30, 60, 90, 180, 365];

  if (milestones.includes(profile.currentStreak)) {
    await processEvent({
      userId,
      tenantId,
      event: "STREAK_MILESTONE",
      referenceId: `streak-${profile.currentStreak}`,
      referenceType: "streak",
    });
  }
}

// ─── Module / Program Completion Detection ──────────────────────────────────

export async function checkModuleCompletion(userId: string, tenantId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      moduleId: true,
      module: {
        select: {
          id: true,
          programId: true,
          lessons: { where: { published: true }, select: { id: true } },
        },
      },
    },
  });
  if (!lesson) return;

  const moduleLessonIds = lesson.module.lessons.map((l) => l.id);
  const completedCount = await prisma.lessonProgress.count({
    where: { userId, lessonId: { in: moduleLessonIds }, completed: true },
  });

  if (completedCount >= moduleLessonIds.length) {
    await processEvent({
      userId,
      tenantId,
      event: "MODULE_COMPLETED",
      referenceId: lesson.module.id,
      referenceType: "module",
    });

    await checkProgramCompletion(userId, tenantId, lesson.module.programId);
  }
}

async function checkProgramCompletion(userId: string, tenantId: string, programId: string) {
  const modules = await prisma.module.findMany({
    where: { programId, published: true },
    select: {
      lessons: { where: { published: true }, select: { id: true } },
    },
  });

  const allLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  if (allLessonIds.length === 0) return;

  const completedCount = await prisma.lessonProgress.count({
    where: { userId, lessonId: { in: allLessonIds }, completed: true },
  });

  if (completedCount >= allLessonIds.length) {
    await processEvent({
      userId,
      tenantId,
      event: "PROGRAM_COMPLETED",
      referenceId: programId,
      referenceType: "program",
    });
  }
}

// ─── Rules CRUD ─────────────────────────────────────────────────────────────

export async function listRules(tenantId: string) {
  return prisma.gamificationRule.findMany({
    where: { tenantId },
    include: { badge: { select: { id: true, title: true, slug: true, iconUrl: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getRule(tenantId: string, ruleId: string) {
  const rule = await prisma.gamificationRule.findFirst({
    where: { id: ruleId, tenantId },
    include: {
      badge: { select: { id: true, title: true, slug: true, iconUrl: true } },
      ledgerEntries: { take: 5, orderBy: { createdAt: "desc" } },
    },
  });
  if (!rule) throw new AppError("Regra não encontrada.", 404);
  return rule;
}

export async function createRule(
  tenantId: string,
  data: {
    event: GamificationEvent;
    name: string;
    description?: string;
    xpReward: number;
    badgeId?: string;
    conditions?: Record<string, unknown>;
    active?: boolean;
  }
) {
  return prisma.gamificationRule.create({
    data: {
      tenantId,
      event: data.event,
      name: data.name,
      description: data.description,
      xpReward: data.xpReward,
      badgeId: data.badgeId,
      conditions: data.conditions ? JSON.parse(JSON.stringify(data.conditions)) : undefined,
      active: data.active ?? true,
    },
  });
}

export async function updateRule(
  tenantId: string,
  ruleId: string,
  data: {
    name?: string;
    description?: string;
    xpReward?: number;
    badgeId?: string | null;
    conditions?: Record<string, unknown> | null;
    active?: boolean;
  }
) {
  const rule = await prisma.gamificationRule.findFirst({ where: { id: ruleId, tenantId } });
  if (!rule) throw new AppError("Regra não encontrada.", 404);

  return prisma.gamificationRule.update({
    where: { id: ruleId },
    data: {
      name: data.name,
      description: data.description,
      xpReward: data.xpReward,
      badgeId: data.badgeId,
      conditions: data.conditions !== undefined
        ? (data.conditions ? JSON.parse(JSON.stringify(data.conditions)) : null)
        : undefined,
      active: data.active,
    },
  });
}

export async function deleteRule(tenantId: string, ruleId: string) {
  const rule = await prisma.gamificationRule.findFirst({ where: { id: ruleId, tenantId } });
  if (!rule) throw new AppError("Regra não encontrada.", 404);

  await prisma.gamificationRule.delete({ where: { id: ruleId } });
}
