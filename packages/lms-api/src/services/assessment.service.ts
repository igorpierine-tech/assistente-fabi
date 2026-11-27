import { prisma } from "../config/prisma";
import { AppError } from "./auth.service";
import { processEvent } from "./gamification-engine.service";

export interface QuizQuestion {
  id: string;
  text: string;
  options: { key: string; text: string }[];
  correctKey: string;
}

export interface QuizAnswer {
  questionId: string;
  selectedKey: string;
}

export async function getAssessment(tenantId: string, assessmentId: string) {
  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      lesson: { module: { program: { tenantId } } },
    },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          module: {
            select: {
              title: true,
              program: { select: { slug: true, title: true } },
            },
          },
        },
      },
    },
  });

  if (!assessment) throw new AppError("Avaliação não encontrada.", 404);
  return assessment;
}

export async function getAssessmentsByLesson(tenantId: string, lessonId: string) {
  return prisma.assessment.findMany({
    where: { lessonId, lesson: { module: { program: { tenantId } } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createAssessment(
  tenantId: string,
  lessonId: string,
  data: {
    title: string;
    type?: string;
    description?: string;
    questions?: QuizQuestion[];
    xpReward?: number;
  }
) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { program: { tenantId } } },
  });
  if (!lesson) throw new AppError("Aula não encontrada.", 404);

  return prisma.assessment.create({
    data: {
      lessonId,
      title: data.title,
      type: (data.type as "QUIZ" | "DIAGNOSTIC" | "ACTION_PLAN" | "SELF_EVALUATION") || "QUIZ",
      description: data.description,
      questions: data.questions ? JSON.parse(JSON.stringify(data.questions)) : undefined,
      xpReward: data.xpReward ?? 20,
    },
  });
}

export async function updateAssessment(
  tenantId: string,
  assessmentId: string,
  data: {
    title?: string;
    type?: string;
    description?: string;
    questions?: QuizQuestion[];
    xpReward?: number;
  }
) {
  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      lesson: { module: { program: { tenantId } } },
    },
  });
  if (!assessment) throw new AppError("Avaliação não encontrada.", 404);

  return prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      title: data.title,
      type: data.type as "QUIZ" | "DIAGNOSTIC" | "ACTION_PLAN" | "SELF_EVALUATION" | undefined,
      description: data.description,
      questions: data.questions ? JSON.parse(JSON.stringify(data.questions)) : undefined,
      xpReward: data.xpReward,
    },
  });
}

export async function deleteAssessment(tenantId: string, assessmentId: string) {
  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      lesson: { module: { program: { tenantId } } },
    },
  });
  if (!assessment) throw new AppError("Avaliação não encontrada.", 404);

  await prisma.assessment.delete({ where: { id: assessmentId } });
}

export async function submitAssessment(
  userId: string,
  tenantId: string,
  assessmentId: string,
  data: { answers: QuizAnswer[]; fileUrl?: string }
) {
  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      lesson: { module: { program: { tenantId } } },
    },
  });
  if (!assessment) throw new AppError("Avaliação não encontrada.", 404);

  let score: number | null = null;

  if (assessment.type === "QUIZ" && assessment.questions) {
    const questions = assessment.questions as unknown as QuizQuestion[];
    let correct = 0;
    for (const q of questions) {
      const answer = data.answers.find((a) => a.questionId === q.id);
      if (answer && answer.selectedKey === q.correctKey) correct++;
    }
    score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
  }

  const submission = await prisma.submission.create({
    data: {
      userId,
      assessmentId,
      answers: JSON.parse(JSON.stringify(data.answers)),
      fileUrl: data.fileUrl,
      score,
    },
  });

  if (assessment.xpReward > 0) {
    const alreadyRewarded = await prisma.pointLedger.findFirst({
      where: { userId, referenceType: "assessment", referenceId: assessmentId },
    });

    if (!alreadyRewarded) {
      await prisma.pointLedger.create({
        data: {
          userId,
          points: assessment.xpReward,
          reason: "Avaliação concluída",
          referenceType: "assessment",
          referenceId: assessmentId,
        },
      });
    }
  }

  processEvent({
    userId,
    tenantId,
    event: "ASSESSMENT_SUBMITTED",
    referenceId: assessmentId,
    referenceType: "assessment",
  }).catch(() => {});

  return { ...submission, score };
}

export async function getSubmission(userId: string, assessmentId: string) {
  return prisma.submission.findFirst({
    where: { userId, assessmentId },
    orderBy: { submittedAt: "desc" },
  });
}

export async function reviewSubmission(
  tenantId: string,
  submissionId: string,
  data: { score: number; feedback?: string }
) {
  const submission = await prisma.submission.findFirst({
    where: {
      id: submissionId,
      assessment: { lesson: { module: { program: { tenantId } } } },
    },
  });
  if (!submission) throw new AppError("Submissão não encontrada.", 404);

  return prisma.submission.update({
    where: { id: submissionId },
    data: {
      score: data.score,
      feedback: data.feedback,
      reviewedAt: new Date(),
    },
  });
}
