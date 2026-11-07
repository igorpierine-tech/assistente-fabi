import type { NextFunction, Request, Response } from "express";
import { getWorkspaceId } from "../services/auth-config";
import { getGoogleTokens } from "../services/google-tokens-db";
import { getMasterUserById, getTenantById } from "../services/master-db";
import type { UserRole } from "../services/users-db";

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.appUser) {
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
  return req.session.appUser!.id;
}

export function personalOwnerId(req: Request): string {
  return req.session.appUser?.id || "";
}

/**
 * Admin-aware read scope: returns null for admin (= all data), otherwise
 * delegates to sharedOwnerId. Use for READ operations only.
 */
export function readOwnerId(req: Request): string | null {
  if (req.session.appUser?.role === "admin") return null;
  return sharedOwnerId(req);
}

export function personalReadOwnerId(req: Request): string | null {
  if (req.session.appUser?.role === "admin") return null;
  return req.session.appUser?.id || "";
}

export function requirePlatformRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.session.appUser?.id;
    if (!userId) {
      res.status(401).json({ error: "Não autenticado" });
      return;
    }
    const masterUser = getMasterUserById(userId);
    if (!masterUser || !allowed.includes(masterUser.platform_role)) {
      res.status(403).json({ error: "Acesso restrito a administradores da plataforma" });
      return;
    }
    next();
  };
}

export function requireActiveTenant() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const tenantId = req.session.appUser?.tenantId;
    if (!tenantId) {
      res.status(401).json({ error: "Tenant não selecionado" });
      return;
    }
    const tenant = getTenantById(tenantId);
    if (!tenant || tenant.active !== 1) {
      res.status(403).json({ error: "Empresa desativada ou inexistente", code: "TENANT_BLOCKED" });
      return;
    }
    next();
  };
}

export function requireModule(moduleId: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const allowed = req.session.appUser?.allowedModules;
    if (!allowed || !allowed.includes(moduleId)) {
      res.status(403).json({ error: `Módulo "${moduleId}" não disponível no seu plano ou perfil`, code: "MODULE_BLOCKED" });
      return;
    }
    next();
  };
}

export function requireTenantModule(moduleId: string) {
  const checkTenant = requireActiveTenant();
  const checkModule = requireModule(moduleId);
  return (req: Request, res: Response, next: NextFunction): void => {
    checkTenant(req, res, (err?: unknown) => {
      if (err || res.headersSent) return;
      checkModule(req, res, next);
    });
  };
}

export function requireGoogleCalendar(req: Request, res: Response, next: NextFunction): void {
  const userId = req.session.appUser?.id;
  if (!userId || !getGoogleTokens(userId)) {
    res.status(401).json({ error: "Google Calendar não conectado", connectUrl: "/auth/google-calendar" });
    return;
  }
  next();
}
