import { Request, Response, NextFunction } from "express";
import * as billingService from "../services/billing.service";

export async function hotmartWebhookHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const hottok = (req.query.hottok as string) || (req.headers["x-hotmart-hottok"] as string) || "";
    await billingService.handleHotmartWebhook(req.body, hottok);
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
