import type { NextFunction, Request, Response } from "express";
import { writeAuditLog } from "../services/database";

export function auditRequests(req: Request, res: Response, next: NextFunction): void {
  res.on("finish", () => {
    const userId = req.session?.googleUser?.id;
    if (!userId) return;
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
    const shouldAudit = req.method !== "GET" || route.includes("/:id") || route.includes("/privacy/export");
    if (!shouldAudit) return;
    try {
      writeAuditLog(userId, req.method, route.slice(0, 160), res.statusCode);
    } catch (error) {
      console.error("Falha ao registrar auditoria:", error instanceof Error ? error.message : "erro desconhecido");
    }
  });
  next();
}
