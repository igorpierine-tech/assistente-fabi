import type { NextFunction, Request, Response } from "express";
import { tenantContext } from "../services/tenant-context";

export function resolveTenant(req: Request, res: Response, next: NextFunction): void {
  const appUser = req.session.appUser;
  if (appUser?.tenantId && appUser?.tenantSlug) {
    tenantContext.run(
      { tenantId: appUser.tenantId, tenantSlug: appUser.tenantSlug },
      () => next()
    );
    return;
  }
  next();
}
