import { prisma } from "../config/prisma";
import { AppError } from "./auth.service";
import { processEvent } from "./gamification-engine.service";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function listPrograms(tenantId: string, onlyPublished = false) {
  return prisma.program.findMany({
    where: { tenantId, ...(onlyPublished ? { published: true } : {}) },
    include: {
      _count: { select: { modules: true, enrollments: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getProgram(tenantId: string, slug: string) {
  const program = await prisma.program.findUnique({
    where: { tenantId_slug: { tenantId, slug } },
    include: {
      modules: {
        where: { published: true },
        include: {
          lessons: {
            where: { published: true },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              slug: true,
              title: true,
              description: true,
              type: true,
              videoDuration: true,
              xpReward: true,
              sortOrder: true,
            },
          },
          _count: { select: { lessons: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { enrollments: true } },
    },
  });

  if (!program) throw new AppError("Programa não encontrado.", 404);
  return program;
}

export async function listProgramsTree(tenantId: string) {
  return prisma.program.findMany({
    where: { tenantId },
    select: {
      id: true,
      title: true,
      slug: true,
      modules: {
        select: {
          id: true,
          title: true,
          slug: true,
          lessons: {
            select: { id: true, title: true, slug: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getProgramAdmin(tenantId: string, programId: string) {
  const program = await prisma.program.findFirst({
    where: { id: programId, tenantId },
    include: {
      modules: {
        include: {
          lessons: { orderBy: { sortOrder: "asc" } },
          _count: { select: { lessons: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { enrollments: true } },
    },
  });

  if (!program) throw new AppError("Programa não encontrado.", 404);
  return program;
}

export async function createProgram(
  tenantId: string,
  data: { title: string; subtitle?: string; description?: string; coverUrl?: string }
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { maxPrograms: true, _count: { select: { programs: true } } },
  });

  if (!tenant) throw new AppError("Tenant não encontrado.", 404);
  if (tenant._count.programs >= tenant.maxPrograms) {
    throw new AppError(`Limite de ${tenant.maxPrograms} programas atingido. Faça upgrade do plano.`, 403);
  }

  let slug = slugify(data.title);
  let attempt = 0;
  while (await prisma.program.findUnique({ where: { tenantId_slug: { tenantId, slug } } })) {
    attempt++;
    slug = `${slugify(data.title)}-${attempt}`;
  }

  return prisma.program.create({
    data: {
      tenantId,
      slug,
      title: data.title,
      subtitle: data.subtitle,
      description: data.description,
      coverUrl: data.coverUrl,
    },
  });
}

export async function updateProgram(
  tenantId: string,
  programId: string,
  data: { title?: string; subtitle?: string; description?: string; coverUrl?: string; published?: boolean; sortOrder?: number }
) {
  const program = await prisma.program.findFirst({ where: { id: programId, tenantId } });
  if (!program) throw new AppError("Programa não encontrado.", 404);

  return prisma.program.update({
    where: { id: programId },
    data,
  });
}

export async function deleteProgram(tenantId: string, programId: string) {
  const program = await prisma.program.findFirst({ where: { id: programId, tenantId } });
  if (!program) throw new AppError("Programa não encontrado.", 404);

  await prisma.program.delete({ where: { id: programId } });
}

export async function enrollStudent(tenantId: string, programId: string, userId: string) {
  const program = await prisma.program.findFirst({
    where: { id: programId, tenantId, published: true },
  });
  if (!program) throw new AppError("Programa não encontrado.", 404);

  const existing = await prisma.enrollment.findUnique({
    where: { userId_programId: { userId, programId } },
  });
  if (existing) throw new AppError("Aluno já está matriculado neste programa.", 409);

  const enrollment = await prisma.enrollment.create({
    data: { userId, programId },
  });

  processEvent({
    userId,
    tenantId,
    event: "ENROLLMENT_CREATED",
    referenceId: enrollment.id,
    referenceType: "enrollment",
  }).catch(() => {});

  return enrollment;
}

export async function listEnrolledPrograms(userId: string) {
  return prisma.enrollment.findMany({
    where: { userId },
    include: {
      program: {
        include: {
          modules: {
            where: { published: true },
            include: {
              _count: { select: { lessons: { where: { published: true } } } },
            },
            orderBy: { sortOrder: "asc" },
          },
          _count: { select: { modules: true, enrollments: true } },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });
}
