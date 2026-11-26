import { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";
import { AppError } from "../services/auth.service";

function getMeta(req: Request) {
  return {
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers["user-agent"],
  };
}

export async function signupHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.signup(req.body, getMeta(req));
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body, getMeta(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const tokens = await authService.refreshAccessToken(req.body.refreshToken, getMeta(req));
    res.json(tokens);
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken || !req.userId) {
      res.status(400).json({ error: "Refresh token obrigatório." });
      return;
    }
    await authService.logout(refreshToken, req.userId);
    res.json({ message: "Logout realizado com sucesso." });
  } catch (err) {
    next(err);
  }
}

export async function forgotPasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.forgotPassword(req.body.email, req.body.tenantSlug, { ip: req.ip });
    res.json({ message: "Se o e-mail estiver cadastrado, você receberá as instruções de recuperação." });
  } catch (err) {
    next(err);
  }
}

export async function resetPasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.resetPassword(req.body.token, req.body.password, { ip: req.ip });
    res.json({ message: "Senha redefinida com sucesso." });
  } catch (err) {
    next(err);
  }
}

export async function profileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }
    const profile = await authService.getProfile(req.userId);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}
