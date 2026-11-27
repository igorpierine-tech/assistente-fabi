import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  listBadgesHandler,
  getUserBadgesHandler,
  checkBadgesHandler,
  leaderboardHandler,
  xpSummaryHandler,
  createBadgeHandler,
  deleteBadgeHandler,
} from "../controllers/gamification.controller";
import {
  listRulesHandler,
  getRuleHandler,
  createRuleHandler,
  updateRuleHandler,
  deleteRuleHandler,
  getProfileHandler,
} from "../controllers/gamification-engine.controller";
import { createRuleSchema, updateRuleSchema } from "../schemas/gamification-rule";

export const gamificationRouter: Router = Router();

gamificationRouter.use(authenticate);

gamificationRouter.get("/badges", listBadgesHandler);
gamificationRouter.get("/badges/my", getUserBadgesHandler);
gamificationRouter.post("/badges/check", checkBadgesHandler);
gamificationRouter.get("/leaderboard", leaderboardHandler);
gamificationRouter.get("/xp", xpSummaryHandler);
gamificationRouter.get("/profile", getProfileHandler);

gamificationRouter.post(
  "/badges",
  requireRole("OWNER", "ADMIN"),
  createBadgeHandler
);
gamificationRouter.delete(
  "/badges/:badgeId",
  requireRole("OWNER", "ADMIN"),
  deleteBadgeHandler
);

gamificationRouter.get("/rules", requireRole("OWNER", "ADMIN"), listRulesHandler);
gamificationRouter.get("/rules/:id", requireRole("OWNER", "ADMIN"), getRuleHandler);
gamificationRouter.post("/rules", requireRole("OWNER", "ADMIN"), validate(createRuleSchema), createRuleHandler);
gamificationRouter.patch("/rules/:id", requireRole("OWNER", "ADMIN"), validate(updateRuleSchema), updateRuleHandler);
gamificationRouter.delete("/rules/:id", requireRole("OWNER", "ADMIN"), deleteRuleHandler);
