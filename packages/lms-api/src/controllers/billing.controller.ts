import { Request, Response, NextFunction } from "express";
import * as billingService from "../services/billing.service";

export async function checkoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }
    const result = await billingService.createCheckoutSession(req.tenantId, req.body.plan);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function portalHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }
    const result = await billingService.createPortalSession(req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function webhookHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = req.headers["stripe-signature"] as string;
    if (!signature) {
      res.status(400).json({ error: "Assinatura Stripe ausente." });
      return;
    }
    await billingService.handleWebhook(req.body, signature);
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}

export async function billingInfoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenantId) {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }
    const info = await billingService.getTenantBilling(req.tenantId);
    res.json(info);
  } catch (err) {
    next(err);
  }
}
