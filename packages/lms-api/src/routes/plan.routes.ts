import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createPlanSchema,
  updatePlanSchema,
  setPlanContentsSchema,
  createSubscriptionSchema,
  updateSubscriptionSchema,
} from "../schemas/plan";
import {
  listPlansHandler,
  getPlanHandler,
  createPlanHandler,
  updatePlanHandler,
  deletePlanHandler,
  setPlanContentsHandler,
  listSubscriptionsHandler,
  createSubscriptionHandler,
  updateSubscriptionHandler,
} from "../controllers/plan.controller";

export const planRouter: Router = Router();

planRouter.use(authenticate);

planRouter.get("/", listPlansHandler);
planRouter.get("/:id", getPlanHandler);
planRouter.post("/", requireRole("OWNER", "ADMIN"), validate(createPlanSchema), createPlanHandler);
planRouter.patch("/:id", requireRole("OWNER", "ADMIN"), validate(updatePlanSchema), updatePlanHandler);
planRouter.delete("/:id", requireRole("OWNER", "ADMIN"), deletePlanHandler);

planRouter.put("/:id/contents", requireRole("OWNER", "ADMIN"), validate(setPlanContentsSchema), setPlanContentsHandler);

planRouter.get("/subscriptions/all", requireRole("OWNER", "ADMIN"), listSubscriptionsHandler);
planRouter.post("/subscriptions", requireRole("OWNER", "ADMIN"), validate(createSubscriptionSchema), createSubscriptionHandler);
planRouter.patch("/subscriptions/:id", requireRole("OWNER", "ADMIN"), validate(updateSubscriptionSchema), updateSubscriptionHandler);
