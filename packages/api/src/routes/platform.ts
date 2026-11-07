import { timingSafeEqual } from "node:crypto";
import { Router, type Router as ExpressRouter } from "express";
import {
  createTenant,
  getTenantBySlug,
  listTenants,
  createMasterUser,
  listMasterUsers,
  getMasterUserByEmail,
} from "../services/master-db";
import { hashPassword } from "../services/users-db";
import { getTenantDb } from "../services/database";
import { upsertTenantConfig } from "../services/database";
import { consultarCnpj } from "../services/cnpj-lookup";
import { rateLimit } from "../middleware/security";
import { tenantContext } from "../services/tenant-context";
import { requiredString, optionalString, optionalEmail } from "../services/validation";

const router: ExpressRouter = Router();

function getAdminToken(): string | null {
  const token = process.env.ADMIN_TOKEN;
  if (!token || token.length < 16) return null;
  return token;
}

function requireAdminToken(req: import("express").Request, res: import("express").Response): boolean {
  const expected = getAdminToken();
  if (!expected) {
    res.status(501).json({ error: "ADMIN_TOKEN não configurado" });
    return false;
  }
  const provided = req.get("x-admin-token") || (req.body as { token?: string })?.token;
  if (!provided) {
    res.status(401).json({ error: "Token de admin obrigatório" });
    return false;
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Token inválido" });
    return false;
  }
  return true;
}

router.get("/tenants", (req, res) => {
  if (!requireAdminToken(req, res)) return;
  res.json(listTenants());
});

router.post("/tenants", async (req, res) => {
  if (!requireAdminToken(req, res)) return;

  const body = req.body || {};
  const name = requiredString(body.name, "name", 200);
  const rawSlug = requiredString(body.slug, "slug", 100);
  const adminName = optionalString(body.adminName, "adminName", 200);
  const adminEmail = requiredString(body.adminEmail, "adminEmail", 254).toLowerCase();
  const adminPassword = requiredString(body.adminPassword, "adminPassword", 128);
  if (adminPassword.length < 8) {
    res.status(400).json({ error: "Senha deve ter no mínimo 8 caracteres" });
    return;
  }

  const safeSlug = rawSlug.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (safeSlug.length < 2) {
    res.status(400).json({ error: "Slug deve ter pelo menos 2 caracteres alfanuméricos" });
    return;
  }

  const existing = getTenantBySlug(safeSlug);
  if (existing) {
    res.status(409).json({ error: "Já existe um tenant com esse slug" });
    return;
  }

  const existingUser = getMasterUserByEmail(adminEmail);
  if (existingUser) {
    res.status(409).json({ error: "Já existe um usuário com esse e-mail" });
    return;
  }

  const tenant = createTenant({ name, slug: safeSlug });

  // Initialize the tenant database (creates all tables)
  getTenantDb(safeSlug);

  const passwordHash = await hashPassword(adminPassword);
  const user = createMasterUser({
    tenantId: tenant.id,
    name: adminName || name,
    email: adminEmail,
    passwordHash,
    role: "admin",
  });

  res.status(201).json({
    tenant,
    admin: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

router.get("/tenants/:slug/users", (req, res) => {
  if (!requireAdminToken(req, res)) return;
  const tenant = getTenantBySlug(req.params.slug);
  if (!tenant) {
    res.status(404).json({ error: "Tenant não encontrado" });
    return;
  }
  const users = listMasterUsers(tenant.id).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
  }));
  res.json(users);
});

router.post("/tenants/:slug/users", async (req, res) => {
  if (!requireAdminToken(req, res)) return;

  const tenant = getTenantBySlug(req.params.slug);
  if (!tenant) {
    res.status(404).json({ error: "Tenant não encontrado" });
    return;
  }

  const body = req.body || {};
  const name = requiredString(body.name, "name", 200);
  const email = requiredString(body.email, "email", 254).toLowerCase();
  const password = requiredString(body.password, "password", 128);
  const role = optionalString(body.role, "role", 50);
  if (password.length < 8) {
    res.status(400).json({ error: "Senha deve ter no mínimo 8 caracteres" });
    return;
  }

  const existing = getMasterUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: "Já existe um usuário com esse e-mail" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = createMasterUser({
    tenantId: tenant.id,
    name,
    email,
    passwordHash,
    role: role || "colaborador",
  });

  res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
});

// --- Public endpoints (no admin token needed) ---

const registerLimiter = rateLimit({ prefix: "register", windowMs: 60 * 60_000, max: 10 });
const cnpjLimiter = rateLimit({ prefix: "cnpj", windowMs: 60_000, max: 15 });

router.get("/cnpj/:cnpj", cnpjLimiter, async (req, res) => {
  try {
    const data = await consultarCnpj(req.params.cnpj);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao consultar CNPJ";
    res.status(400).json({ error: message });
  }
});

router.post("/register", registerLimiter, async (req, res) => {
  const body = req.body || {};
  const cnpj = requiredString(body.cnpj, "cnpj", 30);
  const razaoSocial = requiredString(body.razaoSocial, "razaoSocial", 300);
  const nomeFantasia = optionalString(body.nomeFantasia, "nomeFantasia", 300);
  const endereco = optionalString(body.endereco, "endereco", 500);
  const cep = optionalString(body.cep, "cep", 20);
  const municipio = optionalString(body.municipio, "municipio", 100);
  const uf = optionalString(body.uf, "uf", 2);
  const telefone = optionalString(body.telefone, "telefone", 30);
  const emailEmpresa = optionalEmail(body.emailEmpresa);
  const adminName = requiredString(body.adminName, "adminName", 200);
  const adminEmail = requiredString(body.adminEmail, "adminEmail", 254).toLowerCase();
  const adminPassword = requiredString(body.adminPassword, "adminPassword", 128);
  if (adminPassword.length < 8) {
    res.status(400).json({ error: "Senha deve ter no mínimo 8 caracteres" });
    return;
  }

  const cleanCnpj = String(cnpj).replace(/\D/g, "");
  if (cleanCnpj.length !== 14) {
    res.status(400).json({ error: "CNPJ inválido" });
    return;
  }

  const slug = cleanCnpj;
  const existing = getTenantBySlug(slug);
  if (existing) {
    res.status(409).json({ error: "Esta empresa já está cadastrada na plataforma" });
    return;
  }

  const existingUser = getMasterUserByEmail(adminEmail);
  if (existingUser) {
    res.status(409).json({ error: "Já existe um usuário com esse e-mail" });
    return;
  }

  try {
    const tenant = createTenant({ name: razaoSocial, slug });

    tenantContext.run({ tenantId: tenant.id, tenantSlug: tenant.slug }, () => {
      const db = getTenantDb(tenant.slug);

      const workspaceId = tenant.id;
      upsertTenantConfig(workspaceId, {
        business_name: nomeFantasia || razaoSocial,
        owner_name: adminName,
        razao_social: razaoSocial,
        cnpj: cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"),
        endereco: endereco || null,
        cep: cep || null,
        email_comercial: emailEmpresa || null,
        telefone_comercial: telefone || null,
        onboarding_completed: 1,
      });
    });

    const passwordHash = await hashPassword(adminPassword);
    const user = createMasterUser({
      tenantId: tenant.id,
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: "admin",
    });

    res.status(201).json({
      success: true,
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      admin: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Erro ao registrar empresa:", err);
    res.status(500).json({ error: "Erro interno ao registrar empresa" });
  }
});

export { router as platformRouter };
