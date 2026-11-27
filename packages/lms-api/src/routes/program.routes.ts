import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { checkProgramLimit } from "../middleware/plan-limits";
import {
  listProgramsHandler,
  listProgramsTreeHandler,
  getProgramHandler,
  getProgramAdminHandler,
  createProgramHandler,
  updateProgramHandler,
  deleteProgramHandler,
  enrollHandler,
  myProgramsHandler,
} from "../controllers/program.controller";

export const programRouter: Router = Router();

programRouter.use(authenticate);

programRouter.get("/my", myProgramsHandler);
programRouter.get("/tree", requireRole("OWNER", "ADMIN", "MENTOR"), listProgramsTreeHandler);
programRouter.get("/", listProgramsHandler);
programRouter.get("/by-slug/:slug", getProgramHandler);
programRouter.post("/:id/enroll", enrollHandler);

programRouter.get("/:id/admin", requireRole("OWNER", "ADMIN", "MENTOR"), getProgramAdminHandler);
programRouter.post("/", requireRole("OWNER", "ADMIN", "MENTOR"), checkProgramLimit, createProgramHandler);
programRouter.patch("/:id", requireRole("OWNER", "ADMIN", "MENTOR"), updateProgramHandler);
programRouter.delete("/:id", requireRole("OWNER", "ADMIN"), deleteProgramHandler);
