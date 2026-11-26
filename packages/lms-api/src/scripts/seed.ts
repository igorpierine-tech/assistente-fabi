import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding LMS database...");

  // ─── Tenant ─────────────────────────────────────────────────────────────────

  const tenant = await prisma.tenant.upsert({
    where: { slug: "raizes-e-riquezas" },
    update: {},
    create: {
      slug: "raizes-e-riquezas",
      name: "Raízes e Riquezas",
      plan: "PRO",
      maxStudents: 100,
      maxPrograms: 10,
      maxStorageMb: 5000,
    },
  });

  // ─── Users ──────────────────────────────────────────────────────────────────

  const ownerHash = await bcrypt.hash("Admin@2024", 12);
  const mentorHash = await bcrypt.hash("Mentor@2024", 12);
  const studentHash = await bcrypt.hash("Aluno@2024", 12);

  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@lideraurea.com.br" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "admin@lideraurea.com.br",
      passwordHash: ownerHash,
      role: Role.OWNER,
      emailVerified: true,
      profile: {
        create: {
          firstName: "Administrador",
          lastName: "Plataforma",
          lgpdConsentAt: new Date(),
          lgpdConsentVersion: "1.0",
        },
      },
    },
  });

  const mentor = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "fabiana@lideraurea.com.br" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "fabiana@lideraurea.com.br",
      passwordHash: mentorHash,
      role: Role.MENTOR,
      emailVerified: true,
      profile: {
        create: {
          firstName: "Fabiana",
          lastName: "Raízes",
          company: "Raízes e Riquezas",
          jobTitle: "Mentora Executiva",
          lgpdConsentAt: new Date(),
          lgpdConsentVersion: "1.0",
        },
      },
    },
  });

  const student = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "aluno@exemplo.com.br" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "aluno@exemplo.com.br",
      passwordHash: studentHash,
      role: Role.STUDENT,
      emailVerified: true,
      profile: {
        create: {
          firstName: "Maria",
          lastName: "Executiva",
          company: "Empresa S.A.",
          jobTitle: "Diretora de Operações",
          lgpdConsentAt: new Date(),
          lgpdConsentVersion: "1.0",
        },
      },
    },
  });

  // ─── Program ────────────────────────────────────────────────────────────────

  const program = await prisma.program.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "mentoria-lider-aurea" } },
    update: {},
    create: {
      tenantId: tenant.id,
      slug: "mentoria-lider-aurea",
      title: "Mentoria Líder Áurea",
      subtitle: "Programa de Desenvolvimento de Liderança Executiva",
      description:
        "Um programa intensivo de mentoria executiva focado em desenvolver lideranças de alto impacto através de constelação sistêmica, inteligência emocional e estratégia financeira.",
      published: true,
      sortOrder: 1,
    },
  });

  // ─── Modules & Lessons ──────────────────────────────────────────────────────

  const mod1 = await prisma.module.upsert({
    where: { programId_slug: { programId: program.id, slug: "fundamentos-lideranca" } },
    update: {},
    create: {
      programId: program.id,
      slug: "fundamentos-lideranca",
      title: "Módulo 1 — Fundamentos da Liderança Áurea",
      description: "Base conceitual e diagnóstico de maturidade de liderança.",
      sortOrder: 1,
      published: true,
    },
  });

  const mod2 = await prisma.module.upsert({
    where: { programId_slug: { programId: program.id, slug: "inteligencia-emocional" } },
    update: {},
    create: {
      programId: program.id,
      slug: "inteligencia-emocional",
      title: "Módulo 2 — Inteligência Emocional na Liderança",
      description: "Autoconhecimento, regulação emocional e empatia estratégica.",
      sortOrder: 2,
      published: true,
    },
  });

  await prisma.lesson.upsert({
    where: { moduleId_slug: { moduleId: mod1.id, slug: "boas-vindas" } },
    update: {},
    create: {
      moduleId: mod1.id,
      slug: "boas-vindas",
      title: "Boas-vindas à Mentoria Líder Áurea",
      description: "Apresentação do programa, objetivos e sua jornada de transformação.",
      type: "VIDEO",
      videoDuration: 900,
      xpReward: 10,
      sortOrder: 1,
      published: true,
    },
  });

  await prisma.lesson.upsert({
    where: { moduleId_slug: { moduleId: mod1.id, slug: "diagnostico-lideranca" } },
    update: {},
    create: {
      moduleId: mod1.id,
      slug: "diagnostico-lideranca",
      title: "Diagnóstico de Maturidade de Liderança",
      description: "Autoavaliação completa para mapear seu perfil de liderança atual.",
      type: "ASSESSMENT",
      xpReward: 30,
      sortOrder: 2,
      published: true,
    },
  });

  await prisma.lesson.upsert({
    where: { moduleId_slug: { moduleId: mod1.id, slug: "encontro-ao-vivo-1" } },
    update: {},
    create: {
      moduleId: mod1.id,
      slug: "encontro-ao-vivo-1",
      title: "Encontro ao Vivo — Alinhamento de Expectativas",
      description: "Primeiro encontro com a mentora para definir metas e expectativas.",
      type: "LIVE",
      xpReward: 20,
      sortOrder: 3,
      published: true,
    },
  });

  await prisma.lesson.upsert({
    where: { moduleId_slug: { moduleId: mod2.id, slug: "pilares-ie" } },
    update: {},
    create: {
      moduleId: mod2.id,
      slug: "pilares-ie",
      title: "Os 5 Pilares da Inteligência Emocional",
      description: "Autoconhecimento, autoregulação, motivação, empatia e habilidades sociais.",
      type: "VIDEO",
      videoDuration: 1800,
      xpReward: 15,
      sortOrder: 1,
      published: true,
    },
  });

  // ─── Assessments ────────────────────────────────────────────────────────────

  const diagLesson = await prisma.lesson.findFirst({
    where: { moduleId: mod1.id, slug: "diagnostico-lideranca" },
  });

  if (diagLesson) {
    await prisma.assessment.upsert({
      where: { id: diagLesson.id },
      update: {},
      create: {
        lessonId: diagLesson.id,
        title: "Quiz — Fundamentos da Liderança",
        type: "QUIZ",
        description: "Teste seus conhecimentos sobre os fundamentos da liderança executiva.",
        xpReward: 25,
        questions: [
          {
            id: "q1",
            text: "Qual é o pilar central da liderança áurea?",
            options: [
              { key: "A", text: "Autoridade hierárquica" },
              { key: "B", text: "Autoconhecimento e propósito" },
              { key: "C", text: "Resultados financeiros" },
              { key: "D", text: "Controle de equipe" },
            ],
            correctKey: "B",
          },
          {
            id: "q2",
            text: "O que a constelação sistêmica organizacional revela?",
            options: [
              { key: "A", text: "Apenas conflitos interpessoais" },
              { key: "B", text: "Padrões ocultos que afetam a dinâmica organizacional" },
              { key: "C", text: "A estrutura hierárquica ideal" },
              { key: "D", text: "Métricas de desempenho financeiro" },
            ],
            correctKey: "B",
          },
          {
            id: "q3",
            text: "Qual é o primeiro passo do diagnóstico de maturidade de liderança?",
            options: [
              { key: "A", text: "Definir metas financeiras" },
              { key: "B", text: "Avaliar competidores" },
              { key: "C", text: "Mapear o perfil atual de liderança" },
              { key: "D", text: "Implementar mudanças imediatas" },
            ],
            correctKey: "C",
          },
          {
            id: "q4",
            text: "Na liderança executiva, inteligência emocional é importante porque:",
            options: [
              { key: "A", text: "Substitui competências técnicas" },
              { key: "B", text: "Permite manipular equipes" },
              { key: "C", text: "Amplia a capacidade de tomar decisões e liderar sob pressão" },
              { key: "D", text: "Elimina conflitos completamente" },
            ],
            correctKey: "C",
          },
        ],
      },
    });
  }

  // ─── Badges ─────────────────────────────────────────────────────────────────

  await prisma.badge.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "primeiro-acesso" } },
    update: { criteria: { type: "lessons_completed", threshold: 1 } },
    create: {
      tenantId: tenant.id,
      slug: "primeiro-acesso",
      title: "Primeiro Passo",
      description: "Complete sua primeira aula na plataforma.",
      xpReward: 5,
      criteria: { type: "lessons_completed", threshold: 1 },
    },
  });

  await prisma.badge.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "dedicacao" } },
    update: { criteria: { type: "lessons_completed", threshold: 3 } },
    create: {
      tenantId: tenant.id,
      slug: "dedicacao",
      title: "Dedicação Exemplar",
      description: "Complete 3 aulas do programa.",
      xpReward: 15,
      criteria: { type: "lessons_completed", threshold: 3 },
    },
  });

  await prisma.badge.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "diagnostico-concluido" } },
    update: { criteria: { type: "assessments_passed", threshold: 1 } },
    create: {
      tenantId: tenant.id,
      slug: "diagnostico-concluido",
      title: "Avaliação Conquistada",
      description: "Passe em sua primeira avaliação com nota acima de 70%.",
      xpReward: 50,
      criteria: { type: "assessments_passed", threshold: 1 },
    },
  });

  await prisma.badge.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "presenca-ativa" } },
    update: { criteria: { type: "xp_total", threshold: 100 } },
    create: {
      tenantId: tenant.id,
      slug: "presenca-ativa",
      title: "Centurião",
      description: "Acumule 100 XP na plataforma.",
      xpReward: 30,
      criteria: { type: "xp_total", threshold: 100 },
    },
  });

  await prisma.badge.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "mestre-aurea" } },
    update: { criteria: { type: "xp_total", threshold: 500 } },
    create: {
      tenantId: tenant.id,
      slug: "mestre-aurea",
      title: "Mestre Áureo",
      description: "Acumule 500 XP e demonstre excelência na jornada.",
      xpReward: 100,
      criteria: { type: "xp_total", threshold: 500 },
    },
  });

  // ─── Enrollment ─────────────────────────────────────────────────────────────

  await prisma.enrollment.upsert({
    where: { userId_programId: { userId: student.id, programId: program.id } },
    update: {},
    create: { userId: student.id, programId: program.id },
  });

  console.log("Seed concluído!");
  console.log(`  Tenant: ${tenant.slug} (${tenant.name})`);
  console.log(`  Owner: admin@lideraurea.com.br / Admin@2024`);
  console.log(`  Mentora: fabiana@lideraurea.com.br / Mentor@2024`);
  console.log(`  Aluna: aluno@exemplo.com.br / Aluno@2024`);
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
