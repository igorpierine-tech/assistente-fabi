import { RequestHandler } from "express";
import { prisma } from "../config/prisma";

export const checkStudentLimit: RequestHandler = async (req, res, next) => {
  try {
    if (!req.tenantId) {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        maxStudents: true,
        _count: { select: { users: { where: { role: "STUDENT" } } } },
      },
    });

    if (!tenant) {
      res.status(404).json({ error: "Tenant não encontrado." });
      return;
    }

    if (tenant._count.users >= tenant.maxStudents) {
      res.status(403).json({
        error: "Limite de alunos do plano atingido.",
        code: "PLAN_LIMIT_STUDENTS",
        limit: tenant.maxStudents,
        current: tenant._count.users,
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
};

export const checkProgramLimit: RequestHandler = async (req, res, next) => {
  try {
    if (!req.tenantId) {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        maxPrograms: true,
        _count: { select: { programs: true } },
      },
    });

    if (!tenant) {
      res.status(404).json({ error: "Tenant não encontrado." });
      return;
    }

    if (tenant._count.programs >= tenant.maxPrograms) {
      res.status(403).json({
        error: "Limite de programas do plano atingido.",
        code: "PLAN_LIMIT_PROGRAMS",
        limit: tenant.maxPrograms,
        current: tenant._count.programs,
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
};
