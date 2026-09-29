import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type Router as ExpressRouter } from "express";
import { google } from "googleapis";
import { consumeMobileLogin, createMobileLogin, signSessionId } from "../services/mobile-auth";
import { rateLimit } from "../middleware/security";
import { isEmailAuthorized } from "../services/auth-config";
import { findOrCreateGoogleUser, getUserByEmail, verifyPassword } from "../services/users-db";
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

    if (!isEmailAuthorized(email)) {
      res.status(403).send(
        `Acesso não autorizado para ${email || "esta conta"}. Peça ao administrador para adicionar seu e-mail à lista de permissões.`
      );
      return;
    }

    const googleTokens = { ...req.session.googleTokens, ...tokens };
    const googleUser = {
      id: userInfo.data.id || "google-user",
      name: userInfo.data.name || "",
      email,
    };

    const appUser = findOrCreateGoogleUser(googleUser);

    if (!appUser.active) {
      res.status(403).send("Conta desativada. Entre em contato com o administrador.");
      return;
    }

    const isMobile = req.session.oauthPlatform === "mobile";

    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        res.status(500).send("Não foi possível proteger a sessão.");
        return;
      }
      req.session.googleTokens = googleTokens;
      req.session.googleUser = googleUser;
      req.session.appUser = {
        id: appUser.id,
        name: appUser.name,
        email: appUser.email,
        role: appUser.role,
      };
      req.session.save((saveError) => {
        if (saveError) {
          res.status(500).send("Não foi possível salvar a sessão.");
          return;
        }
        const code = createMobileLogin(req.sessionID, {
          ...googleUser,
          appUser: {
            id: appUser.id,
            name: appUser.name,
            email: appUser.email,
            role: appUser.role,
          },
        });
        if (isMobile) {
          res.redirect(`assistente-fabi://auth/callback?code=${encodeURIComponent(code)}`);
        } else {
          const webUrl = process.env.WEB_URL || "http://localhost:3000";
          res.redirect(`${webUrl}/?auth_code=${encodeURIComponent(code)}`);
        }
      });
    });
  } catch (error) {
    console.error("Erro na autenticação Google:", error instanceof Error ? error.message : "erro desconhecido");
    res.status(500).send("Falha na autenticação Google.");
  }
});

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
  const googleUser = req.session.googleUser;
  const authenticated = Boolean(appUser || googleUser);
  res.json({
    authenticated,
    user: appUser
      ? { id: appUser.id, name: appUser.name, email: appUser.email, role: appUser.role }
      : googleUser ?? null,
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) res.status(500).json({ error: "Não foi possível encerrar a sessão." });
    else res.status(204).end();
  });
});

export { router as authRouter };
