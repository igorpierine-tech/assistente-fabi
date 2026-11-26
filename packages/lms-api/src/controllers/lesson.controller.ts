import { Request, Response, NextFunction } from "express";
import * as lessonService from "../services/lesson.service";

function param(req: Request, name: string): string {
  const v = req.params[name];
  return typeof v === "string" ? v : "";
}

export async function getLessonHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const lesson = await lessonService.getLesson(req.tenantId, param(req, "lessonId"));
    res.json(lesson);
  } catch (err) { next(err); }
}

export async function createLessonHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const lesson = await lessonService.createLesson(
      req.tenantId,
      param(req, "programId"),
      param(req, "moduleId"),
      req.body
    );
    res.status(201).json(lesson);
  } catch (err) { next(err); }
}

export async function updateLessonHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const lesson = await lessonService.updateLesson(req.tenantId, param(req, "lessonId"), req.body);
    res.json(lesson);
  } catch (err) { next(err); }
}

export async function deleteLessonHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    await lessonService.deleteLesson(req.tenantId, param(req, "lessonId"));
    res.json({ message: "Aula removida." });
  } catch (err) { next(err); }
}

export async function markCompleteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const progress = await lessonService.markLessonComplete(req.userId, param(req, "lessonId"));
    res.json(progress);
  } catch (err) { next(err); }
}

export async function updateWatchTimeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const { watchTime } = req.body;
    if (typeof watchTime !== "number") { res.status(400).json({ error: "watchTime é obrigatório." }); return; }
    const progress = await lessonService.updateWatchTime(req.userId, param(req, "lessonId"), watchTime);
    res.json(progress);
  } catch (err) { next(err); }
}

export async function programProgressHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const progress = await lessonService.getProgramProgress(req.userId, param(req, "programId"));
    res.json(progress);
  } catch (err) { next(err); }
}
