import { prisma } from "../config/prisma";
import { AppError } from "./auth.service";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function verifyProgramOwnership(tenantId: string, programId: string) {
  const program = await prisma.program.findFirst({ where: { id: programId, tenantId } });
  if (!program) throw new AppError("Programa não encontrado.", 404);
  return program;
}

export async function listModules(tenantId: string, programId: string) {
  await verifyProgramOwnership(tenantId, programId);
  return prisma.module.findMany({
    where: { programId },
    include: {
      _count: { select: { lessons: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getModule(tenantId: string, programId: string, moduleId: string) {
  await verifyProgramOwnership(tenantId, programId);
  const mod = await prisma.module.findFirst({
    where: { id: moduleId, programId },
    include: {
      lessons: {
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
          published: true,
        },
      },
    },
  });

  if (!mod) throw new AppError("Módulo não encontrado.", 404);
  return mod;
}

export async function createModule(
  tenantId: string,
  programId: string,
  data: { title: string; description?: string }
) {
  await verifyProgramOwnership(tenantId, programId);

  const count = await prisma.module.count({ where: { programId } });

  let slug = slugify(data.title);
  let attempt = 0;
  while (await prisma.module.findUnique({ where: { programId_slug: { programId, slug } } })) {
    attempt++;
    slug = `${slugify(data.title)}-${attempt}`;
  }

  return prisma.module.create({
    data: {
      programId,
      slug,
      title: data.title,
      description: data.description,
      sortOrder: count + 1,
    },
  });
}

export async function updateModule(
  tenantId: string,
  programId: string,
  moduleId: string,
  data: { title?: string; description?: string; published?: boolean; sortOrder?: number }
) {
  await verifyProgramOwnership(tenantId, programId);
  const mod = await prisma.module.findFirst({ where: { id: moduleId, programId } });
  if (!mod) throw new AppError("Módulo não encontrado.", 404);

  return prisma.module.update({ where: { id: moduleId }, data });
}

export async function deleteModule(tenantId: string, programId: string, moduleId: string) {
  await verifyProgramOwnership(tenantId, programId);
  const mod = await prisma.module.findFirst({ where: { id: moduleId, programId } });
  if (!mod) throw new AppError("Módulo não encontrado.", 404);

  await prisma.module.delete({ where: { id: moduleId } });
}
