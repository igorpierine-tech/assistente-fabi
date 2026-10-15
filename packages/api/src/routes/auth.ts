import { randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { Router, type Router as ExpressRouter } from "express";
import { google } from "googleapis";
import { consumeMobileLogin, signSessionId } from "../services/mobile-auth";
import { rateLimit } from "../middleware/security";
import { getUserByEmail, verifyPassword } from "../services/users-db";
import { saveGoogleTokens, getGoogleTokenRow, deleteGoogleTokens } from "../services/google-tokens-db";
import "../session-types";

const router: ExpressRouter = Router();
const authLimiter = rateLimit({ prefix: "auth", windowMs: 10 * 60_000, max: 20 });

function getOAuth2Client(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || process.env.GOOGLE_REDIRECT_URI
  );
}

function signCalendarState(userId: string): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${userId}.${nonce}`;
  const hmac = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(payload)
    .digest("hex");
  return `${payload}.${hmac}`;
}

function verifyCalendarState(state: unknown): string | null {
  if (typeof state !== "string") return null;
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [userId, nonce, hmac] = parts;
  const expected = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(`${userId}.${nonce}`)
    .digest("hex");
  const a = Buffer.from(hmac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

// --- Email/password login ---

router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "E-mail e senha são obrigatórios" });
    return;
  }

  const user = getUserByEmail(email);
  if (!user || !user.password_hash) {
    res.status(401).json({ error: "E-mail ou senha inválidos" });
    return;
  }

  if (!user.active) {
    res.status(403).json({ error: "Conta desativada" });
    return;
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: "E-mail ou senha inválidos" });
    return;
  }

  req.session.regenerate((err) => {
    if (err) {
      res.status(500).json({ error: "Erro ao criar sessão" });
      return;
    }
    req.session.appUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    req.session.save((saveErr) => {
      if (saveErr) {
        res.status(500).json({ error: "Erro ao salvar sessão" });
        return;
      }
      const token = signSessionId(req.sessionID, process.env.SESSION_SECRET!);
      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    });
  });
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
  const appUser = req.session.appUser;
  const calendarRow = appUser ? getGoogleTokenRow(appUser.id) : null;
  res.json({
    authenticated: Boolean(appUser),
    user: appUser
      ? { id: appUser.id, name: appUser.name, email: appUser.email, role: appUser.role }
      : null,
    calendarConnected: Boolean(calendarRow),
    calendarEmail: calendarRow?.google_email ?? null,
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) res.status(500).json({ error: "Não foi possível encerrar a sessão." });
    else res.status(204).end();
  });
});

// --- Google Calendar connection (separate from login) ---

const CALENDAR_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI?.replace("/auth/google/callback", "/auth/google-calendar/callback");

router.get("/google-calendar", authLimiter, (req, res) => {
  if (!req.session.appUser) {
    res.status(401).json({ error: "Faça login primeiro" });
    return;
  }
  const state = signCalendarState(req.session.appUser.id);
  const oauth2 = getOAuth2Client(CALENDAR_REDIRECT_URI);
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state,
    scope: ["https://www.googleapis.com/auth/calendar"],
  });
  res.json({ url });
});

router.get("/google-calendar/callback", authLimiter, async (req, res) => {
  const userId = verifyCalendarState(req.query.state);
  if (!userId) {
    res.status(400).send("Estado OAuth inválido. Reinicie a conexão.");
    return;
  }
  if (typeof req.query.code !== "string") {
    res.status(400).send("Código de autorização não encontrado.");
    return;
  }

  try {
    const oauth2 = getOAuth2Client(CALENDAR_REDIRECT_URI);
    const { tokens } = await oauth2.getToken(req.query.code);
    if (!tokens.refresh_token) {
      res.status(400).send("O Google não forneceu refresh_token. Revogue o acesso do aplicativo e tente novamente.");
      return;
    }

    let googleEmail: string | undefined;
    try {
      oauth2.setCredentials(tokens);
      const userInfo = await google.oauth2({ version: "v2", auth: oauth2 }).userinfo.get();
      googleEmail = userInfo.data.email || undefined;
    } catch {
      // email is optional metadata
    }

    saveGoogleTokens(userId, tokens, googleEmail);
    const webUrl = process.env.WEB_URL || "http://localhost:3000";
    res.redirect(`${webUrl}/?calendar_connected=1`);
  } catch (error) {
    console.error("Erro ao conectar Google Calendar:", error instanceof Error ? error.message : "erro desconhecido");
    res.status(500).send("Falha ao conectar Google Calendar.");
  }
});

router.post("/google-calendar/disconnect", (req, res) => {
  if (!req.session.appUser) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  deleteGoogleTokens(req.session.appUser.id);
  res.status(204).end();
});

router.get("/google-calendar/status", (req, res) => {
  if (!req.session.appUser) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  const row = getGoogleTokenRow(req.session.appUser.id);
  res.json({
    connected: Boolean(row),
    email: row?.google_email ?? null,
  });
});

export { router as authRouter };
