import { Request, Response, NextFunction } from "express";
import * as moduleService from "../services/module.service";

function param(req: Request, name: string): string {
  const v = req.params[name];
  return typeof v === "string" ? v : "";
}

export async function listModulesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const modules = await moduleService.listModules(req.tenantId, param(req, "programId"));
    res.json(modules);
  } catch (err) { next(err); }
}

export async function getModuleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const mod = await moduleService.getModule(req.tenantId, param(req, "programId"), param(req, "id"));
    res.json(mod);
  } catch (err) { next(err); }
}

export async function createModuleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const mod = await moduleService.createModule(req.tenantId, param(req, "programId"), req.body);
    res.status(201).json(mod);
  } catch (err) { next(err); }
}

export async function updateModuleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    const mod = await moduleService.updateModule(req.tenantId, param(req, "programId"), param(req, "id"), req.body);
    res.json(mod);
  } catch (err) { next(err); }
}

export async function deleteModuleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Não autenticado." }); return; }
    await moduleService.deleteModule(req.tenantId, param(req, "programId"), param(req, "id"));
    res.json({ message: "Módulo removido." });
  } catch (err) { next(err); }
}
