import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { ensureEntitledContent } from "../middleware/entitlement";
import {
  getLessonHandler,
  createLessonHandler,
  updateLessonHandler,
  deleteLessonHandler,
  markCompleteHandler,
  updateWatchTimeHandler,
  programProgressHandler,
} from "../controllers/lesson.controller";

export const lessonRouter: Router = Router({ mergeParams: true });

lessonRouter.use(authenticate);

lessonRouter.get("/progress/:programId", programProgressHandler);

lessonRouter.get("/:lessonId", ensureEntitledContent("lesson", "lessonId"), getLessonHandler);
lessonRouter.post("/:lessonId/complete", ensureEntitledContent("lesson", "lessonId"), markCompleteHandler);
lessonRouter.patch("/:lessonId/watch-time", ensureEntitledContent("lesson", "lessonId"), updateWatchTimeHandler);

lessonRouter.post(
  "/program/:programId/module/:moduleId",
  requireRole("OWNER", "ADMIN", "MENTOR"),
  createLessonHandler
);
lessonRouter.patch(
  "/:lessonId",
  requireRole("OWNER", "ADMIN", "MENTOR"),
  updateLessonHandler
);
lessonRouter.delete(
  "/:lessonId",
  requireRole("OWNER", "ADMIN"),
  deleteLessonHandler
);
