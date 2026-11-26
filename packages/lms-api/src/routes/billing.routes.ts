import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  hotmartWebhookHandler,
  billingInfoHandler,
} from "../controllers/billing.controller";

export const billingRouter: Router = Router();

billingRouter.post("/webhook/hotmart", hotmartWebhookHandler);

billingRouter.use(authenticate);

billingRouter.get("/info", billingInfoHandler);
