import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import {
  listModulesHandler,
  getModuleHandler,
  createModuleHandler,
  updateModuleHandler,
  deleteModuleHandler,
} from "../controllers/module.controller";

export const moduleRouter: Router = Router({ mergeParams: true });

moduleRouter.use(authenticate);

moduleRouter.get("/", listModulesHandler);
moduleRouter.get("/:id", getModuleHandler);

moduleRouter.post("/", requireRole("OWNER", "ADMIN", "MENTOR"), createModuleHandler);
moduleRouter.patch("/:id", requireRole("OWNER", "ADMIN", "MENTOR"), updateModuleHandler);
moduleRouter.delete("/:id", requireRole("OWNER", "ADMIN"), deleteModuleHandler);
