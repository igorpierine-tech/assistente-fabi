import type { NextFunction, Request, Response } from "express";

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.googleUser) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

export function requireGoogleCalendar(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.googleTokens) {
    res.status(401).json({ error: "Google Calendar não conectado" });
    return;
  }
  next();
}
