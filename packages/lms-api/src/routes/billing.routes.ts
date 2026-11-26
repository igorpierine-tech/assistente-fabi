import { Router } from "express";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/auth";
import { createCheckoutSchema } from "../schemas/billing";
import {
  checkoutHandler,
  portalHandler,
  webhookHandler,
  billingInfoHandler,
} from "../controllers/billing.controller";

export const billingRouter: Router = Router();

billingRouter.post("/webhook", webhookHandler);

billingRouter.use(authenticate);

billingRouter.post("/checkout", requireRole("OWNER", "ADMIN"), validate(createCheckoutSchema), checkoutHandler);
billingRouter.post("/portal", requireRole("OWNER", "ADMIN"), portalHandler);
billingRouter.get("/info", billingInfoHandler);
