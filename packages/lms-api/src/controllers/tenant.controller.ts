import { Request, Response, NextFunction } from "express";
import * as tenantService from "../services/tenant.service";

export async function getTenantHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const tenant = await tenantService.getTenant(req.tenantId);
    res.json(tenant);
  } catch (err) { next(err); }
}

export async function updateTenantHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const tenant = await tenantService.updateTenant(req.tenantId, req.body);
    res.json(tenant);
  } catch (err) { next(err); }
}

export async function listMembersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const members = await tenantService.listMembers(req.tenantId);
    res.json(members);
  } catch (err) { next(err); }
}

export async function inviteMemberHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const member = await tenantService.inviteMember(req.tenantId, req.body);
    res.status(201).json(member);
  } catch (err) { next(err); }
}

export async function removeMemberHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId || !req.userId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const memberId = typeof req.params.id === "string" ? req.params.id : undefined;
    if (!memberId) { res.status(400).json({ error: "ID do membro é obrigatório." }); return; }
    await tenantService.removeMember(req.tenantId, memberId, req.userId);
    res.json({ message: "Membro removido." });
  } catch (err) { next(err); }
}

export async function updateMemberRoleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId || !req.userId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const memberId = typeof req.params.id === "string" ? req.params.id : undefined;
    if (!memberId) { res.status(400).json({ error: "ID do membro é obrigatório." }); return; }
    const result = await tenantService.updateMemberRole(req.tenantId, memberId, req.body.role, req.userId);
    res.json(result);
  } catch (err) { next(err); }
}
