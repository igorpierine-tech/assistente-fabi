import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import {
  listBadgesHandler,
  getUserBadgesHandler,
  checkBadgesHandler,
  leaderboardHandler,
  xpSummaryHandler,
  createBadgeHandler,
  deleteBadgeHandler,
} from "../controllers/gamification.controller";

export const gamificationRouter: Router = Router();

gamificationRouter.use(authenticate);

gamificationRouter.get("/badges", listBadgesHandler);
gamificationRouter.get("/badges/my", getUserBadgesHandler);
gamificationRouter.post("/badges/check", checkBadgesHandler);
gamificationRouter.get("/leaderboard", leaderboardHandler);
gamificationRouter.get("/xp", xpSummaryHandler);

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
