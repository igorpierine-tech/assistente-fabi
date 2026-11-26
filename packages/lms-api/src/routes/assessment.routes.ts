import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import {
  getAssessmentHandler,
  getByLessonHandler,
  createAssessmentHandler,
  updateAssessmentHandler,
  deleteAssessmentHandler,
  submitAssessmentHandler,
  getSubmissionHandler,
  reviewSubmissionHandler,
} from "../controllers/assessment.controller";

export const assessmentRouter: Router = Router();

assessmentRouter.use(authenticate);

assessmentRouter.get("/lesson/:lessonId", getByLessonHandler);
assessmentRouter.get("/:assessmentId", getAssessmentHandler);
assessmentRouter.get("/:assessmentId/submission", getSubmissionHandler);
assessmentRouter.post("/:assessmentId/submit", submitAssessmentHandler);

assessmentRouter.post(
  "/lesson/:lessonId",
  requireRole("OWNER", "ADMIN", "MENTOR"),
  createAssessmentHandler
);
assessmentRouter.patch(
  "/:assessmentId",
  requireRole("OWNER", "ADMIN", "MENTOR"),
  updateAssessmentHandler
);
assessmentRouter.delete(
  "/:assessmentId",
  requireRole("OWNER", "ADMIN"),
  deleteAssessmentHandler
);

assessmentRouter.patch(
  "/submissions/:submissionId/review",
  requireRole("OWNER", "ADMIN", "MENTOR"),
  reviewSubmissionHandler
);
