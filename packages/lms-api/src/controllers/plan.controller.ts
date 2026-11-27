import { Request, Response, NextFunction } from "express";
import * as planService from "../services/plan.service";

// ─── PLANS ──────────────────────────────────────────────────────────────────

export async function listPlansHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const onlyActive = req.userRole === "STUDENT";
    const plans = await planService.listPlans(req.tenantId, onlyActive);
    res.json(plans);
  } catch (err) { next(err); }
}

export async function getPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const plan = await planService.getPlan(req.tenantId, id);
    res.json(plan);
  } catch (err) { next(err); }
}

export async function createPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const plan = await planService.createPlan(req.tenantId, req.body);
    res.status(201).json(plan);
  } catch (err) { next(err); }
}

export async function updatePlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const plan = await planService.updatePlan(req.tenantId, id, req.body);
    res.json(plan);
  } catch (err) { next(err); }
}

export async function deletePlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    await planService.deletePlan(req.tenantId, id);
    res.json({ message: "Plano removido." });
  } catch (err) { next(err); }
}

// ─── PLAN CONTENTS ──────────────────────────────────────────────────────────

export async function setPlanContentsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const plan = await planService.setPlanContents(req.tenantId, id, req.body);
    res.json(plan);
  } catch (err) { next(err); }
}

// ─── SUBSCRIPTIONS ──────────────────────────────────────────────────────────

export async function listSubscriptionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const planId = typeof req.query.planId === "string" ? req.query.planId : undefined;
    const subs = await planService.listSubscriptions(req.tenantId, planId);
    res.json(subs);
  } catch (err) { next(err); }
}

export async function createSubscriptionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const sub = await planService.createSubscription(req.tenantId, req.body);
    res.status(201).json(sub);
  } catch (err) { next(err); }
}

export async function updateSubscriptionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const sub = await planService.updateSubscription(id, req.tenantId, req.body);
    res.json(sub);
  } catch (err) { next(err); }
}
