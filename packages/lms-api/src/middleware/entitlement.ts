import { RequestHandler } from "express";
import { checkEntitlement } from "../services/plan.service";
import { prisma } from "../config/prisma";

type ContentLevel = "program" | "module" | "lesson";

export function ensureEntitledContent(level: ContentLevel, paramName = "id"): RequestHandler {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Não autenticado." });
        return;
      }

      if (req.userRole === "OWNER" || req.userRole === "ADMIN" || req.userRole === "MENTOR") {
        next();
        return;
      }

      const rawId = req.params[paramName];
      const contentId = typeof rawId === "string" ? rawId : "";
      if (!contentId) {
        res.status(400).json({ error: "ID do conteúdo não informado." });
        return;
      }

      const hasPlans = await prisma.plan.count({ where: { tenantId: req.tenantId! } });
      if (hasPlans === 0) {
        next();
        return;
      }

      const content: { programId?: string; moduleId?: string; lessonId?: string } = {};
      if (level === "program") content.programId = contentId;
      else if (level === "module") content.moduleId = contentId;
      else content.lessonId = contentId;

      const entitled = await checkEntitlement(req.userId, content);
      if (!entitled) {
        res.status(403).json({
          error: "Conteúdo não disponível no seu plano atual.",
          code: "ENTITLEMENT_REQUIRED",
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
