import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import {
  listProgramsHandler,
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
programRouter.get("/", listProgramsHandler);
programRouter.get("/by-slug/:slug", getProgramHandler);
programRouter.post("/:id/enroll", enrollHandler);

programRouter.get("/:id/admin", requireRole("OWNER", "ADMIN", "MENTOR"), getProgramAdminHandler);
programRouter.post("/", requireRole("OWNER", "ADMIN", "MENTOR"), createProgramHandler);
programRouter.patch("/:id", requireRole("OWNER", "ADMIN", "MENTOR"), updateProgramHandler);
programRouter.delete("/:id", requireRole("OWNER", "ADMIN"), deleteProgramHandler);
