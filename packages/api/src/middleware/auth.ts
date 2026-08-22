import type { NextFunction, Request, Response } from "express";
import { getWorkspaceId } from "../services/auth-config";

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.googleUser) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

/**
 * Returns the id to use for SHARED resources (clients, catalog, receivables,
 * sales, booking settings/types/requests). Falls back to the personal user id
 * when no workspace is configured.
 */
export function sharedOwnerId(req: Request): string {
  const workspaceId = getWorkspaceId();
  return workspaceId || req.session.googleUser!.id;
}

/**
 * Returns the id to use for PER-USER resources — currently only
 * appointments — so each Google account keeps its own calendar in sync.
 */
export function personalOwnerId(req: Request): string {
  return req.session.googleUser!.id;
}

export function requireGoogleCalendar(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.googleTokens) {
    res.status(401).json({ error: "Google Calendar não conectado" });
    return;
  }
  next();
}
