import { prisma } from "../config/prisma";
import { AppError } from "./auth.service";
import { checkAndAwardBadges } from "./gamification.service";
import { processEvent, checkModuleCompletion, updateStreak } from "./gamification-engine.service";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function verifyModuleOwnership(tenantId: string, programId: string, moduleId: string) {
  const mod = await prisma.module.findFirst({
    where: { id: moduleId, programId, program: { tenantId } },
  });
  if (!mod) throw new AppError("Módulo não encontrado.", 404);
  return mod;
}

export async function getLesson(tenantId: string, lessonId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { program: { tenantId } } },
    include: {
      materials: { orderBy: { sortOrder: "asc" } },
      module: {
        select: {
          id: true,
          slug: true,
          title: true,
          programId: true,
          program: { select: { slug: true, title: true } },
        },
      },
    },
  });

  if (!lesson) throw new AppError("Aula não encontrada.", 404);
  return lesson;
}

export async function createLesson(
  tenantId: string,
  programId: string,
  moduleId: string,
  data: {
    title: string;
    description?: string;
    type?: string;
    videoUrl?: string;
    videoDuration?: number;
    liveUrl?: string;
    liveStartsAt?: string;
    content?: string;
    xpReward?: number;
  }
) {
  await verifyModuleOwnership(tenantId, programId, moduleId);

  const count = await prisma.lesson.count({ where: { moduleId } });

  let slug = slugify(data.title);
  let attempt = 0;
  while (await prisma.lesson.findUnique({ where: { moduleId_slug: { moduleId, slug } } })) {
    attempt++;
    slug = `${slugify(data.title)}-${attempt}`;
  }

  return prisma.lesson.create({
    data: {
      moduleId,
      slug,
      title: data.title,
      description: data.description,
      type: (data.type as "VIDEO" | "LIVE" | "TEXT" | "ASSESSMENT") || "VIDEO",
      videoUrl: data.videoUrl,
      videoDuration: data.videoDuration,
      liveUrl: data.liveUrl,
      liveStartsAt: data.liveStartsAt ? new Date(data.liveStartsAt) : undefined,
      content: data.content,
      xpReward: data.xpReward ?? 10,
      sortOrder: count + 1,
    },
  });
}

export async function updateLesson(
  tenantId: string,
  lessonId: string,
  data: {
    title?: string;
    description?: string;
    type?: string;
    videoUrl?: string;
    videoDuration?: number;
    liveUrl?: string;
    liveStartsAt?: string;
    content?: string;
    xpReward?: number;
    published?: boolean;
    sortOrder?: number;
  }
) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { program: { tenantId } } },
  });
  if (!lesson) throw new AppError("Aula não encontrada.", 404);

  return prisma.lesson.update({
    where: { id: lessonId },
    data: {
      ...data,
      type: data.type as "VIDEO" | "LIVE" | "TEXT" | "ASSESSMENT" | undefined,
      liveStartsAt: data.liveStartsAt ? new Date(data.liveStartsAt) : undefined,
    },
  });
}

export async function deleteLesson(tenantId: string, lessonId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { program: { tenantId } } },
  });
  if (!lesson) throw new AppError("Aula não encontrada.", 404);

  await prisma.lesson.delete({ where: { id: lessonId } });
}

// ─── Progress ───────────────────────────────────────────────────────────────

export async function getLessonProgress(userId: string, lessonId: string) {
  return prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });
}

export async function markLessonComplete(userId: string, lessonId: string, tenantId?: string) {
  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { completed: true, completedAt: new Date() },
    create: { userId, lessonId, completed: true, completedAt: new Date() },
  });

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { xpReward: true },
  });

  if (lesson && lesson.xpReward > 0) {
    const alreadyRewarded = await prisma.pointLedger.findFirst({
      where: { userId, referenceType: "lesson", referenceId: lessonId },
    });

    if (!alreadyRewarded) {
      await prisma.pointLedger.create({
        data: {
          userId,
          points: lesson.xpReward,
          reason: "Aula concluída",
          referenceType: "lesson",
          referenceId: lessonId,
        },
      });
    }
  }

  if (tenantId) {
    checkAndAwardBadges(userId, tenantId).catch(() => {});
    processEvent({
      userId,
      tenantId,
      event: "LESSON_COMPLETED",
      referenceId: lessonId,
      referenceType: "lesson",
    }).catch(() => {});
    checkModuleCompletion(userId, tenantId, lessonId).catch(() => {});
    updateStreak(userId, tenantId).catch(() => {});
  }

  return progress;
}

export async function updateWatchTime(userId: string, lessonId: string, watchTime: number) {
  return prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { watchTime },
    create: { userId, lessonId, watchTime },
  });
}

export async function getProgramProgress(userId: string, programId: string) {
  const lessons = await prisma.lesson.findMany({
    where: { module: { programId }, published: true },
    select: { id: true },
  });

  const lessonIds = lessons.map((l) => l.id);

  const completed = await prisma.lessonProgress.count({
    where: { userId, lessonId: { in: lessonIds }, completed: true },
  });

  const totalXp = await prisma.pointLedger.aggregate({
    where: { userId },
    _sum: { points: true },
  });

  return {
    totalLessons: lessons.length,
    completedLessons: completed,
    percentComplete: lessons.length > 0 ? Math.round((completed / lessons.length) * 100) : 0,
    totalXp: totalXp._sum.points || 0,
  };
}
