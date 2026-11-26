import { prisma } from "../config/prisma";
import { AppError } from "./auth.service";

interface BadgeCriteria {
  type: "lessons_completed" | "xp_total" | "assessments_passed" | "streak_days";
  threshold: number;
}

export async function listBadges(tenantId: string) {
  return prisma.badge.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getUserBadges(userId: string) {
  return prisma.userBadge.findMany({
    where: { userId },
    include: { badge: true },
    orderBy: { earnedAt: "desc" },
  });
}

export async function checkAndAwardBadges(userId: string, tenantId: string) {
  const badges = await prisma.badge.findMany({
    where: { tenantId, criteria: { not: { equals: undefined } } },
  });

  const earned = await prisma.userBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  });
  const earnedIds = new Set(earned.map((e) => e.badgeId));

  const newBadges: string[] = [];

  for (const badge of badges) {
    if (earnedIds.has(badge.id)) continue;

    const criteria = badge.criteria as unknown as BadgeCriteria;
    if (!criteria?.type || !criteria?.threshold) continue;

    let met = false;

    switch (criteria.type) {
      case "lessons_completed": {
        const count = await prisma.lessonProgress.count({
          where: { userId, completed: true },
        });
        met = count >= criteria.threshold;
        break;
      }
      case "xp_total": {
        const agg = await prisma.pointLedger.aggregate({
          where: { userId },
          _sum: { points: true },
        });
        met = (agg._sum.points || 0) >= criteria.threshold;
        break;
      }
      case "assessments_passed": {
        const count = await prisma.submission.count({
          where: { userId, score: { gte: 70 } },
        });
        met = count >= criteria.threshold;
        break;
      }
    }

    if (met) {
      await prisma.userBadge.create({
        data: { userId, badgeId: badge.id },
      });

      if (badge.xpReward > 0) {
        await prisma.pointLedger.create({
          data: {
            userId,
            points: badge.xpReward,
            reason: `Badge: ${badge.title}`,
            entityType: "badge",
            entityId: badge.id,
          },
        });
      }

      newBadges.push(badge.id);
    }
  }

  return newBadges;
}

export async function getLeaderboard(tenantId: string, limit = 20) {
  const rows = await prisma.$queryRaw<
    { user_id: string; first_name: string; last_name: string; avatar_url: string | null; total_xp: bigint }[]
  >`
    SELECT pl.user_id,
           p.first_name,
           p.last_name,
           p.avatar_url,
           COALESCE(SUM(pl.points), 0) AS total_xp
    FROM point_ledger pl
    JOIN users u ON u.id = pl.user_id
    JOIN profiles p ON p.user_id = u.id
    WHERE u.tenant_id = ${tenantId}::uuid
    GROUP BY pl.user_id, p.first_name, p.last_name, p.avatar_url
    ORDER BY total_xp DESC
    LIMIT ${limit}
  `;

  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.user_id,
    firstName: r.first_name,
    lastName: r.last_name,
    avatarUrl: r.avatar_url,
    totalXp: Number(r.total_xp),
  }));
}

export async function getUserXpSummary(userId: string) {
  const agg = await prisma.pointLedger.aggregate({
    where: { userId },
    _sum: { points: true },
  });

  const recentEntries = await prisma.pointLedger.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const badgeCount = await prisma.userBadge.count({ where: { userId } });
  const lessonsCompleted = await prisma.lessonProgress.count({
    where: { userId, completed: true },
  });

  return {
    totalXp: agg._sum.points || 0,
    badgeCount,
    lessonsCompleted,
    recentEntries,
  };
}

export async function createBadge(
  tenantId: string,
  data: {
    title: string;
    description?: string;
    iconUrl?: string;
    xpReward?: number;
    criteria?: BadgeCriteria;
  }
) {
  const slug = data.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return prisma.badge.create({
    data: {
      tenantId,
      slug,
      title: data.title,
      description: data.description,
      iconUrl: data.iconUrl,
      xpReward: data.xpReward ?? 0,
      criteria: data.criteria ? JSON.parse(JSON.stringify(data.criteria)) : undefined,
    },
  });
}

export async function deleteBadge(tenantId: string, badgeId: string) {
  const badge = await prisma.badge.findFirst({ where: { id: badgeId, tenantId } });
  if (!badge) throw new AppError("Badge não encontrada.", 404);
  await prisma.badge.delete({ where: { id: badgeId } });
}
