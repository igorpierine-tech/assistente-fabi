import type { Request, Response, NextFunction } from "express";
import * as svc from "../services/assessment.service";

function param(req: Request, key: string): string {
  const val = req.params[key];
  return typeof val === "string" ? val : "";
}

export async function getAssessmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getAssessment(req.tenantId!, param(req, "assessmentId"));
    res.json(data);
  } catch (e) { next(e); }
}

export async function getByLessonHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getAssessmentsByLesson(req.tenantId!, param(req, "lessonId"));
    res.json(data);
  } catch (e) { next(e); }
}

export async function createAssessmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.createAssessment(req.tenantId!, param(req, "lessonId"), req.body);
    res.status(201).json(data);
  } catch (e) { next(e); }
}

export async function updateAssessmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.updateAssessment(req.tenantId!, param(req, "assessmentId"), req.body);
    res.json(data);
  } catch (e) { next(e); }
}

export async function deleteAssessmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteAssessment(req.tenantId!, param(req, "assessmentId"));
    res.status(204).end();
  } catch (e) { next(e); }
}

export async function submitAssessmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.submitAssessment(
      req.userId!,
      req.tenantId!,
      param(req, "assessmentId"),
      req.body
    );
    res.status(201).json(data);
  } catch (e) { next(e); }
}

export async function getSubmissionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getSubmission(req.userId!, param(req, "assessmentId"));
    res.json(data || null);
  } catch (e) { next(e); }
}

export async function reviewSubmissionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.reviewSubmission(req.tenantId!, param(req, "submissionId"), req.body);
    res.json(data);
  } catch (e) { next(e); }
}
