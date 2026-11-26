import type { Request, Response, NextFunction } from "express";
import * as svc from "../services/gamification.service";

export async function listBadgesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.listBadges(req.tenantId!);
    res.json(data);
  } catch (e) { next(e); }
}

export async function getUserBadgesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getUserBadges(req.userId!);
    res.json(data);
  } catch (e) { next(e); }
}

export async function checkBadgesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const newBadges = await svc.checkAndAwardBadges(req.userId!, req.tenantId!);
    res.json({ newBadges });
  } catch (e) { next(e); }
}

export async function leaderboardHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Number(req.query.limit) || 20;
    const data = await svc.getLeaderboard(req.tenantId!, limit);
    res.json(data);
  } catch (e) { next(e); }
}

export async function xpSummaryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getUserXpSummary(req.userId!);
    res.json(data);
  } catch (e) { next(e); }
}

export async function createBadgeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.createBadge(req.tenantId!, req.body);
    res.status(201).json(data);
  } catch (e) { next(e); }
}

export async function deleteBadgeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const badgeId = typeof req.params.badgeId === "string" ? req.params.badgeId : "";
    await svc.deleteBadge(req.tenantId!, badgeId);
    res.status(204).end();
  } catch (e) { next(e); }
}
