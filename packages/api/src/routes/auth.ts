import { Router } from "express";
import { google } from "googleapis";

const router = Router();

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

const tokenStore = new Map<string, { accessToken: string; refreshToken: string; expiresAt: number }>();

router.get("/google", (_req, res) => {
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
  });
  res.json({ url });
});

router.get("/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Código de autorização não encontrado" });
    return;
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      res.status(400).json({ error: "Token de acesso não recebido" });
      return;
    }

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userId = userInfo.data.id || "default";

    tokenStore.set(userId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || "",
      expiresAt: tokens.expiry_date || Date.now() + 3600000,
    });

    const webUrl = process.env.WEB_URL || "http://localhost:3000";
    res.redirect(`${webUrl}/auth/success?userId=${userId}&name=${encodeURIComponent(userInfo.data.name || "")}`);
  } catch (error) {
    console.error("Erro na autenticação Google:", error);
    res.status(500).json({ error: "Falha na autenticação" });
  }
});

router.get("/status/:userId", (req, res) => {
  const token = tokenStore.get(req.params.userId);
  if (token && token.expiresAt > Date.now()) {
    res.json({ authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});

export function getAccessToken(userId: string): string | null {
  const token = tokenStore.get(userId);
  if (!token) return null;
  if (token.expiresAt < Date.now()) return null;
  return token.accessToken;
}

export { router as authRouter };
