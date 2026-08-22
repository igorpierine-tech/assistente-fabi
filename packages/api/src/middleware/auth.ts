import type { NextFunction, Request, Response } from "express";
import { getWorkspaceId } from "../services/auth-config";

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.googleUser) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  // If a shared workspace is configured, every authenticated user maps to the
  // same workspace_id so they see and edit the same data.
  const workspaceId = getWorkspaceId();
  if (workspaceId && req.session.googleUser.id !== workspaceId) {
    req.session.googleUser = {
      ...req.session.googleUser,
      id: workspaceId,
    };
  }
  next();
}

export function requireGoogleCalendar(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.googleTokens) {
    res.status(401).json({ error: "Google Calendar não conectado" });
    return;
  }
  next();
}
