import type { NextFunction, Request, Response } from "express";
import { getWorkspaceId } from "../services/auth-config";
import type { UserRole } from "../services/users-db";

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.appUser && !req.session.googleUser) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

const ROLE_LEVELS: Record<UserRole, number> = {
  admin: 40,
  gestor: 30,
  colaborador: 20,
  visualizador: 10,
};

export function requireRole(...allowed: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.session.appUser?.role;
    if (!userRole) {
      res.status(403).json({ error: "Perfil de acesso não definido" });
      return;
    }
    if (!allowed.includes(userRole)) {
      res.status(403).json({ error: "Acesso não autorizado para este perfil" });
      return;
    }
    next();
  };
}

export function requireMinRole(minRole: UserRole) {
  const minLevel = ROLE_LEVELS[minRole];
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.session.appUser?.role;
    if (!userRole || (ROLE_LEVELS[userRole] ?? 0) < minLevel) {
      res.status(403).json({ error: "Acesso não autorizado para este perfil" });
      return;
    }
    next();
  };
}

/**
 * Returns the id to use for SHARED resources (clients, catalog, receivables,
 * sales, booking settings/types/requests). Falls back to the personal user id
 * when no workspace is configured.
 */
export function sharedOwnerId(req: Request): string {
  const workspaceId = getWorkspaceId();
  if (workspaceId) return workspaceId;
  return req.session.appUser?.id || req.session.googleUser!.id;
}

/**
 * Returns the id to use for PER-USER resources — currently only
 * appointments — so each Google account keeps its own calendar in sync.
 */
export function personalOwnerId(req: Request): string {
  return req.session.googleUser?.id || req.session.appUser?.id || "";
}

export function requireGoogleCalendar(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.googleTokens) {
    res.status(401).json({ error: "Google Calendar não conectado" });
    return;
  }
  next();
}
