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

  const { name, slug, adminName, adminEmail, adminPassword } = req.body || {};

  if (!name || !slug) {
    res.status(400).json({ error: "name e slug são obrigatórios" });
    return;
  }
  if (!adminEmail || !adminPassword) {
    res.status(400).json({ error: "adminEmail e adminPassword são obrigatórios para o primeiro usuário" });
    return;
  }

  const safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9_-]/g, "");
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

  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email e password são obrigatórios" });
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
  const {
    cnpj, razaoSocial, nomeFantasia,
    endereco, cep, municipio, uf, telefone, emailEmpresa,
    adminName, adminEmail, adminPassword,
  } = req.body || {};

  if (!cnpj || !razaoSocial) {
    res.status(400).json({ error: "CNPJ e razão social são obrigatórios" });
    return;
  }
  if (!adminName || !adminEmail || !adminPassword) {
    res.status(400).json({ error: "Nome, e-mail e senha do administrador são obrigatórios" });
    return;
  }
  if (typeof adminPassword !== "string" || adminPassword.length < 6) {
    res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
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
