import { randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { Router, type Router as ExpressRouter } from "express";
import { google } from "googleapis";
import { consumeMobileLogin, signSessionId } from "../services/mobile-auth";
import { rateLimit } from "../middleware/security";
import { getUserByEmail, verifyPassword } from "../services/users-db";
import { getMasterUserByEmail, getMasterUserById, getUserTenants, getTenantById, getTenantBySlug, getUserModules } from "../services/master-db";
import { saveGoogleTokens, getGoogleTokenRow, deleteGoogleTokens } from "../services/google-tokens-db";
import { validateBody } from "../middleware/validate";
import { loginSchema, selectTenantSchema } from "../schemas";
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

router.post("/login", authLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password, tenantSlug } = req.body;

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

  const userTenants = getUserTenants(user.id);
  if (userTenants.length === 0) {
    res.status(403).json({ error: "Nenhuma empresa ativa vinculada a este usuário" });
    return;
  }

  const masterUser = getMasterUserByEmail(email);
  const platformRole = masterUser?.platform_role || "user";

  // If user has multiple tenants and didn't specify which one, return the list
  if (userTenants.length > 1 && !tenantSlug) {
    req.session.regenerate((err) => {
      if (err) {
        res.status(500).json({ error: "Erro ao criar sessão" });
        return;
      }
      // Store partial auth (authenticated but no tenant selected yet)
      req.session.appUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        platformRole,
        tenantId: "",
        tenantSlug: "",
        allowedModules: [],
      };
      req.session.save((saveErr) => {
        if (saveErr) {
          res.status(500).json({ error: "Erro ao salvar sessão" });
          return;
        }
        const token = signSessionId(req.sessionID, process.env.SESSION_SECRET!);
        res.json({
          requireTenantSelection: true,
          token,
          platformRole,
          user: { id: user.id, name: user.name, email: user.email, role: user.role },
          tenants: userTenants.map((ut) => ({
            id: ut.tenant_id,
            slug: ut.tenant_slug,
            name: ut.tenant_name,
            role: ut.role,
          })),
        });
      });
    });
    return;
  }

  // Pick the tenant: either the one specified or the only one available
  let selectedTenant;
  if (tenantSlug) {
    const match = userTenants.find((ut) => ut.tenant_slug === tenantSlug);
    if (!match) {
      res.status(403).json({ error: "Você não tem acesso a esta empresa" });
      return;
    }
    selectedTenant = { id: match.tenant_id, slug: match.tenant_slug, role: match.role };
  } else {
    selectedTenant = { id: userTenants[0].tenant_id, slug: userTenants[0].tenant_slug, role: userTenants[0].role };
  }

  req.session.regenerate((err) => {
    if (err) {
      res.status(500).json({ error: "Erro ao criar sessão" });
      return;
    }
    const allowedModules = getUserModules(user.id, selectedTenant.id);
    req.session.appUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: selectedTenant.role as string,
      platformRole,
      tenantId: selectedTenant.id,
      tenantSlug: selectedTenant.slug,
      allowedModules,
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
          role: selectedTenant.role,
        },
      });
    });
  });
});

// Select tenant (after login when user has multiple companies)
router.post("/select-tenant", validateBody(selectTenantSchema), (req, res) => {
  const appUser = req.session.appUser;
  if (!appUser) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  const { tenantSlug } = req.body;

  const userTenants = getUserTenants(appUser.id);
  const match = userTenants.find((ut) => ut.tenant_slug === tenantSlug);
  if (!match) {
    res.status(403).json({ error: "Você não tem acesso a esta empresa" });
    return;
  }

  const modules = getUserModules(appUser.id, match.tenant_id);
  const mu = getMasterUserById(appUser.id);
  const updatedUser = {
    ...appUser,
    role: match.role,
    platformRole: mu?.platform_role || appUser.platformRole || "user",
    tenantId: match.tenant_id,
    tenantSlug: match.tenant_slug,
    allowedModules: modules,
  };

  req.session.regenerate((regenErr) => {
    if (regenErr) {
      res.status(500).json({ error: "Erro ao regenerar sessão" });
      return;
    }
    req.session.appUser = updatedUser;
    req.session.save((saveErr) => {
      if (saveErr) {
        res.status(500).json({ error: "Erro ao salvar sessão" });
        return;
      }
      res.json({
        user: {
          id: appUser.id,
          name: appUser.name,
          email: appUser.email,
          role: match.role,
        },
        tenant: {
          id: match.tenant_id,
          slug: match.tenant_slug,
          name: match.tenant_name,
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

  // Check if user is authenticated but hasn't selected a tenant yet
  const needsTenantSelection = Boolean(appUser && !appUser.tenantId);
  let tenants: { id: string; slug: string; name: string; role: string }[] | undefined;
  if (needsTenantSelection && appUser) {
    const userTenants = getUserTenants(appUser.id);
    tenants = userTenants.map((ut) => ({
      id: ut.tenant_id,
      slug: ut.tenant_slug,
      name: ut.tenant_name,
      role: ut.role,
    }));
  }

  res.json({
    authenticated: Boolean(appUser),
    requireTenantSelection: needsTenantSelection,
    user: appUser
      ? { id: appUser.id, name: appUser.name, email: appUser.email, role: appUser.role, platformRole: appUser.platformRole ?? "user" }
      : null,
    tenantId: appUser?.tenantId ?? null,
    tenantSlug: appUser?.tenantSlug ?? null,
    allowedModules: appUser?.allowedModules ?? [],
    tenants,
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
