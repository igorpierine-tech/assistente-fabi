import { Router } from "express";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { rateLimit } from "../middleware/security";
import {
  signupSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "../schemas/auth";
import {
  signupHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  verifyEmailHandler,
  profileHandler,
} from "../controllers/auth.controller";

export const authRouter: Router = Router();

const authRateLimit = rateLimit({ windowMs: 15 * 60_000, max: 10, prefix: "auth" });

authRouter.post("/signup", authRateLimit, validate(signupSchema), signupHandler);
authRouter.post("/login", authRateLimit, validate(loginSchema), loginHandler);
authRouter.post("/refresh", rateLimit({ windowMs: 60_000, max: 30, prefix: "refresh" }), validate(refreshTokenSchema), refreshHandler);
authRouter.post("/logout", authenticate, logoutHandler);
authRouter.post("/forgot-password", authRateLimit, validate(forgotPasswordSchema), forgotPasswordHandler);
authRouter.post("/reset-password", authRateLimit, validate(resetPasswordSchema), resetPasswordHandler);
authRouter.post("/verify-email", validate(verifyEmailSchema), verifyEmailHandler);
authRouter.get("/me", authenticate, profileHandler);
