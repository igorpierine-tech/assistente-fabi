import { Request, Response, NextFunction } from "express";
import * as engine from "../services/gamification-engine.service";

export async function listRulesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const rules = await engine.listRules(req.tenantId);
    res.json(rules);
  } catch (err) { next(err); }
}

export async function getRuleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const rule = await engine.getRule(req.tenantId, id);
    res.json(rule);
  } catch (err) { next(err); }
}

export async function createRuleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const rule = await engine.createRule(req.tenantId, req.body);
    res.status(201).json(rule);
  } catch (err) { next(err); }
}

export async function updateRuleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const rule = await engine.updateRule(req.tenantId, id, req.body);
    res.json(rule);
  } catch (err) { next(err); }
}

export async function deleteRuleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    await engine.deleteRule(req.tenantId, id);
    res.json({ message: "Regra removida." });
  } catch (err) { next(err); }
}

export async function getProfileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const profile = await engine.getProfile(req.userId);
    res.json(profile);
  } catch (err) { next(err); }
}
