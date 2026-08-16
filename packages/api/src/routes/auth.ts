import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type Router as ExpressRouter } from "express";
import { google } from "googleapis";
import "../session-types";

const router: ExpressRouter = Router();

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

router.get("/google", (req, res) => {
  const state = randomBytes(32).toString("base64url");
  const platform = req.query.platform as string | undefined;
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

  if (platform === "mobile") {
    req.session.save(() => res.redirect(url));
    return;
  }
  res.json({ url });
});

router.get("/google/callback", async (req, res) => {
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
    req.session.googleTokens = { ...req.session.googleTokens, ...tokens };
    req.session.googleUser = {
      id: userInfo.data.id || "google-user",
      name: userInfo.data.name || "Fabiana",
      email: userInfo.data.email || undefined,
    };
    delete req.session.oauthState;

    const isMobile = req.session.oauthPlatform === "mobile";
    delete req.session.oauthPlatform;

    req.session.save((error) => {
      if (error) {
        res.status(500).send("Não foi possível salvar a sessão.");
        return;
      }
      if (isMobile) {
        const params = new URLSearchParams({
          name: req.session.googleUser?.name || "Fabiana",
          email: req.session.googleUser?.email || "",
          userId: req.session.googleUser?.id || "google-user",
        });
        res.redirect(`assistente-fabi://auth/callback?${params}`);
      } else {
        const webUrl = process.env.WEB_URL || "http://localhost:3000";
        res.redirect(`${webUrl}/auth/success?userId=session&name=${encodeURIComponent(req.session.googleUser?.name || "Fabiana")}`);
      }
    });
  } catch (error) {
    console.error("Erro na autenticação Google:", error instanceof Error ? error.message : "erro desconhecido");
    res.status(500).send("Falha na autenticação Google.");
  }
});

router.post("/token", async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken || typeof accessToken !== "string") {
    res.status(400).json({ error: "accessToken é obrigatório" });
    return;
  }

  try {
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      res.status(401).json({ error: "Token inválido" });
      return;
    }
    const userInfo = await userRes.json();

    req.session.googleTokens = { access_token: accessToken };
    req.session.googleUser = {
      id: userInfo.sub || "google-user",
      name: userInfo.name || "Usuário",
      email: userInfo.email || undefined,
    };

    req.session.save((err) => {
      if (err) {
        res.status(500).json({ error: "Falha ao salvar sessão" });
        return;
      }
      res.json({
        authenticated: true,
        user: req.session.googleUser,
        sessionId: req.sessionID,
      });
    });
  } catch {
    res.status(500).json({ error: "Erro ao validar token" });
  }
});

router.get("/status/:userId?", (req, res) => {
  res.json({ authenticated: Boolean(req.session.googleTokens), user: req.session.googleUser ?? null });
});

router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) res.status(500).json({ error: "Não foi possível encerrar a sessão." });
    else res.status(204).end();
  });
});

export { router as authRouter };
