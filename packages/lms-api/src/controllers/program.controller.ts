import { Request, Response, NextFunction } from "express";
import * as programService from "../services/program.service";

export async function listProgramsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const onlyPublished = req.userRole === "STUDENT";
    const programs = await programService.listPrograms(req.tenantId, onlyPublished);
    res.json(programs);
  } catch (err) { next(err); }
}

export async function getProgramHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const slug = typeof req.params.slug === "string" ? req.params.slug : "";
    const program = await programService.getProgram(req.tenantId, slug);
    res.json(program);
  } catch (err) { next(err); }
}

export async function listProgramsTreeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const programs = await programService.listProgramsTree(req.tenantId);
    res.json(programs);
  } catch (err) { next(err); }
}

export async function getProgramAdminHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const program = await programService.getProgramAdmin(req.tenantId, id);
    res.json(program);
  } catch (err) { next(err); }
}

export async function createProgramHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const program = await programService.createProgram(req.tenantId, req.body);
    res.status(201).json(program);
  } catch (err) { next(err); }
}

export async function updateProgramHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const program = await programService.updateProgram(req.tenantId, id, req.body);
    res.json(program);
  } catch (err) { next(err); }
}

export async function deleteProgramHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    await programService.deleteProgram(req.tenantId, id);
    res.json({ message: "Programa removido." });
  } catch (err) { next(err); }
}

export async function enrollHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId || !req.userId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const enrollment = await programService.enrollStudent(req.tenantId, id, req.userId);
    res.status(201).json(enrollment);
  } catch (err) { next(err); }
}

export async function myProgramsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const enrollments = await programService.listEnrolledPrograms(req.userId);
    res.json(enrollments);
  } catch (err) { next(err); }
}
