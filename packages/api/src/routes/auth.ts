import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type Router as ExpressRouter } from "express";
import { google } from "googleapis";
import { consumeMobileLogin, createMobileLogin, signSessionId } from "../services/mobile-auth";
import { rateLimit } from "../middleware/security";
import {
  isEmailAuthorized,
  getWorkspaceId,
  getPrimaryAppointmentOwnerEmail,
} from "../services/auth-config";
import { getDb } from "../services/database";
import "../session-types";

const router: ExpressRouter = Router();
const authLimiter = rateLimit({ prefix: "auth", windowMs: 10 * 60_000, max: 20 });

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function validState(expected: string | undefined, received: unknown): boolean {
  if (!expected || typeof received !== "string") return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

router.get("/google", authLimiter, (req, res) => {
  const state = randomBytes(32).toString("base64url");
  const platform = req.query.platform === "mobile" ? "mobile" : "web";
  req.session.oauthState = state;
  req.session.oauthPlatform = platform;
  const url = getOAuth2Client().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state,
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar",
    ],
  });

  // Top-level navigation from web (?redirect=1) or the mobile flow needs a redirect
  // so the browser lands on Google and the session cookie is guaranteed first-party.
  if (platform === "mobile" || req.query.redirect === "1") {
    req.session.save(() => res.redirect(url));
    return;
  }
  res.json({ url });
});

router.get("/google/callback", authLimiter, async (req, res) => {
  if (!validState(req.session.oauthState, req.query.state)) {
    res.status(400).send("Estado OAuth inválido. Reinicie o login.");
    return;
  }
  if (typeof req.query.code !== "string") {
    res.status(400).send("Código de autorização não encontrado.");
    return;
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(req.query.code);
    const previousRefreshToken = req.session.googleTokens?.refresh_token;
    if (!tokens.refresh_token && !previousRefreshToken) {
      res.status(400).send("O Google não forneceu refresh_token. Revogue o acesso do aplicativo e tente novamente.");
      return;
    }
    oauth2Client.setCredentials({ ...req.session.googleTokens, ...tokens });
    const userInfo = await google.oauth2({ version: "v2", auth: oauth2Client }).userinfo.get();
    const email = userInfo.data.email || undefined;

    // Enforce authorized emails allowlist (when configured).
    if (!isEmailAuthorized(email)) {
      res.status(403).send(
        `Acesso não autorizado para ${email || "esta conta"}. Peça ao administrador para adicionar seu e-mail à lista de permissões.`
      );
      return;
    }

    const googleTokens = { ...req.session.googleTokens, ...tokens };
    // Always keep the person's real Google user id in the session.
    // Shared vs per-user scoping is decided per-route via
    // `sharedOwnerId` / `personalOwnerId` helpers.
    const googleUser = {
      id: userInfo.data.id || "google-user",
      name: userInfo.data.name || "Fabiana",
      email,
    };
    const isMobile = req.session.oauthPlatform === "mobile";

    // One-time backfill: if this user is the configured "primary appointment
    // owner", reassign any workspace-owned appointments/booking_requests to
    // their personal id. Safe to run every login (idempotent no-op after
    // the first time).
    try {
      const workspaceId = getWorkspaceId();
      const primaryEmail = getPrimaryAppointmentOwnerEmail();
      if (
        workspaceId &&
        primaryEmail &&
        email &&
        email.toLowerCase() === primaryEmail &&
        googleUser.id !== workspaceId
      ) {
        const db = getDb();
        db.prepare(
          `UPDATE appointments SET user_id = ? WHERE user_id = ?`
        ).run(googleUser.id, workspaceId);
        db.prepare(
          `UPDATE booking_requests SET user_id = ? WHERE user_id = ?`
        ).run(googleUser.id, workspaceId);
        db.prepare(
          `UPDATE conversations SET user_id = ? WHERE user_id = ?`
        ).run(googleUser.id, workspaceId);
      }
    } catch (err) {
      console.warn("Appointment backfill skipped:", (err as Error).message);
    }

    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        res.status(500).send("Não foi possível proteger a sessão.");
        return;
      }
      req.session.googleTokens = googleTokens;
      req.session.googleUser = googleUser;
      req.session.save((saveError) => {
        if (saveError) {
          res.status(500).send("Não foi possível salvar a sessão.");
          return;
        }
        if (isMobile) {
          const code = createMobileLogin(req.sessionID, googleUser);
          res.redirect(`assistente-fabi://auth/callback?code=${encodeURIComponent(code)}`);
        } else {
          const webUrl = process.env.WEB_URL || "http://localhost:3000";
          res.redirect(`${webUrl}/?authenticated=1`);
        }
      });
    });
  } catch (error) {
    console.error("Erro na autenticação Google:", error instanceof Error ? error.message : "erro desconhecido");
    res.status(500).send("Falha na autenticação Google.");
  }
});

router.post("/mobile/exchange", authLimiter, (req, res) => {
  const code = req.body?.code;
  if (typeof code !== "string" || code.length < 32 || code.length > 256) {
    res.status(400).json({ error: "Código de login inválido" });
    return;
  }
  const login = consumeMobileLogin(code);
  if (!login) {
    res.status(401).json({ error: "Código expirado ou já utilizado" });
    return;
  }
  res.json({
    token: signSessionId(login.sessionId, process.env.SESSION_SECRET!),
    user: login.user,
  });
});

router.get("/status", (req, res) => {
  res.json({ authenticated: Boolean(req.session.googleTokens), user: req.session.googleUser ?? null });
});

router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) res.status(500).json({ error: "Não foi possível encerrar a sessão." });
    else res.status(204).end();
  });
});

export { router as authRouter };
