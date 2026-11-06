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

export { router as platformRouter };
