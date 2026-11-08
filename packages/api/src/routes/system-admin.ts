import { Router, type Router as ExpressRouter } from "express";
import {
  listTenants,
  getTenantById,
  getTenantBySlug,
  createTenant,
  updateTenant,
  deleteTenant,
  listMasterUsers,
  getMasterUserByEmail,
  getMasterUserById,
  createMasterUser,
  updateMasterUser,
  getUserTenants,
  addUserToTenant,
  removeUserFromTenant,
  setUserTenantProfile,
  listAccessProfiles,
  getAccessProfileById,
  createAccessProfile,
  updateAccessProfile,
  deleteAccessProfile,
  getUserModules,
  SYSTEM_MODULES,
} from "../services/master-db";
import { hashPassword, updatePassword, getUserByEmail } from "../services/users-db";
import { getTenantDb, upsertTenantConfig } from "../services/database";
import { tenantContext } from "../services/tenant-context";
import { requireUser, requirePlatformRole } from "../middleware/auth";
import { requiredString, optionalString, optionalEmail } from "../services/validation";
import "../session-types";

const router: ExpressRouter = Router();

// Accessible to any authenticated user (before super_admin guard)
router.get("/my-modules", requireUser, (req, res) => {
  const appUser = req.session.appUser;
  if (!appUser?.tenantId) {
    res.json(SYSTEM_MODULES.map(m => m.id));
    return;
  }
  res.json(getUserModules(appUser.id, appUser.tenantId));
});

// Everything below requires super_admin
router.use(requireUser, requirePlatformRole("super_admin"));

// --- Modules ---

router.get("/modules", (_req, res) => {
  res.json(SYSTEM_MODULES);
});

// --- Access Profiles ---

router.get("/profiles", (req, res) => {
  const tenantId = req.session.appUser!.tenantId;
  if (!tenantId) {
    res.status(400).json({ error: "Nenhuma empresa selecionada" });
    return;
  }
  const profiles = listAccessProfiles(tenantId);
  res.json(profiles.map(p => ({
    ...p,
    modules: JSON.parse(p.modules),
  })));
});

router.post("/profiles", (req, res) => {
  const tenantId = req.session.appUser!.tenantId;
  if (!tenantId) {
    res.status(400).json({ error: "Nenhuma empresa selecionada" });
    return;
  }
  const { name, modules } = req.body || {};
  if (!name || !Array.isArray(modules)) {
    res.status(400).json({ error: "name e modules são obrigatórios" });
    return;
  }
  const validModules = modules.filter((m: string) => SYSTEM_MODULES.some(sm => sm.id === m));
  const profile = createAccessProfile({ tenantId, name, modules: validModules });
  res.status(201).json({ ...profile, modules: JSON.parse(profile.modules) });
});

router.put("/profiles/:id", (req, res) => {
  const profile = getAccessProfileById(req.params.id);
  if (!profile) {
    res.status(404).json({ error: "Perfil não encontrado" });
    return;
  }
  const tenantId = req.session.appUser!.tenantId;
  if (profile.tenant_id !== tenantId) {
    res.status(403).json({ error: "Sem permissão" });
    return;
  }
  const { name, modules } = req.body || {};
  const validModules = Array.isArray(modules)
    ? modules.filter((m: string) => SYSTEM_MODULES.some(sm => sm.id === m))
    : undefined;
  const updated = updateAccessProfile(req.params.id, { name, modules: validModules });
  if (updated) {
    res.json({ ...updated, modules: JSON.parse(updated.modules) });
  } else {
    res.status(404).json({ error: "Perfil não encontrado" });
  }
});

router.delete("/profiles/:id", (req, res) => {
  const profile = getAccessProfileById(req.params.id);
  if (!profile) {
    res.status(404).json({ error: "Perfil não encontrado" });
    return;
  }
  const tenantId = req.session.appUser!.tenantId;
  if (profile.tenant_id !== tenantId) {
    res.status(403).json({ error: "Sem permissão" });
    return;
  }
  if (profile.is_default) {
    res.status(400).json({ error: "Não é possível excluir o perfil padrão" });
    return;
  }
  deleteAccessProfile(req.params.id);
  res.status(204).end();
});

// --- Tenants ---

router.get("/tenants", (_req, res) => {
  const tenants = listTenants();
  const result = tenants.map(t => ({
    ...t,
    userCount: listMasterUsers(t.id).length,
  }));
  res.json(result);
});

router.get("/tenants/:id", (req, res) => {
  const tenant = getTenantById(req.params.id);
  if (!tenant) {
    res.status(404).json({ error: "Empresa não encontrada" });
    return;
  }
  res.json({
    ...tenant,
    userCount: listMasterUsers(tenant.id).length,
  });
});

router.post("/tenants", async (req, res) => {
  const body = req.body || {};
  const name = requiredString(body.name, "name", 200);
  const rawSlug = requiredString(body.slug, "slug", 100);
  const adminName = optionalString(body.adminName, "adminName", 200);
  const adminEmail = optionalEmail(body.adminEmail);
  const adminPassword = optionalString(body.adminPassword, "adminPassword", 128);
  const cnpj = optionalString(body.cnpj, "cnpj", 30);
  const inscricaoMunicipal = optionalString(body.inscricaoMunicipal, "inscricaoMunicipal", 30);
  const endereco = optionalString(body.endereco, "endereco", 500);
  const cep = optionalString(body.cep, "cep", 20);
  const municipio = optionalString(body.municipio, "municipio", 100);
  const uf = optionalString(body.uf, "uf", 2);
  const telefone = optionalString(body.telefone, "telefone", 30);
  const emailEmpresa = optionalEmail(body.emailEmpresa);

  const safeSlug = rawSlug.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (safeSlug.length < 2) {
    res.status(400).json({ error: "Slug deve ter pelo menos 2 caracteres" });
    return;
  }
  if (getTenantBySlug(safeSlug)) {
    res.status(409).json({ error: "Já existe uma empresa com esse slug" });
    return;
  }

  const tenant = createTenant({ name, slug: safeSlug });
  tenantContext.run({ tenantId: tenant.id, tenantSlug: tenant.slug }, () => {
    getTenantDb(tenant.slug);
  });

  let admin = null;
  let adminUserId: string | null = null;
  if (adminEmail && adminPassword) {
    const existing = getMasterUserByEmail(adminEmail);
    if (existing) {
      addUserToTenant(existing.id, tenant.id, "admin");
      admin = { id: existing.id, name: existing.name, email: existing.email };
      adminUserId = existing.id;
    } else {
      const passwordHash = await hashPassword(adminPassword);
      const user = createMasterUser({
        tenantId: tenant.id,
        name: adminName || name,
        email: adminEmail,
        passwordHash,
        role: "admin",
      });
      admin = { id: user.id, name: user.name, email: user.email };
      adminUserId = user.id;
    }
  }

  const hasCompanyData = cnpj || inscricaoMunicipal || endereco || cep || municipio || uf || telefone || emailEmpresa;
  if (hasCompanyData) {
    const configUserId = adminUserId || req.session.appUser!.id;
    const fullEndereco = [endereco, municipio && uf ? `${municipio}/${uf}` : municipio || uf].filter(Boolean).join(" — ");
    tenantContext.run({ tenantId: tenant.id, tenantSlug: tenant.slug }, () => {
      upsertTenantConfig(configUserId, {
        razao_social: name,
        cnpj: cnpj ? String(cnpj).replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : null,
        inscricao_municipal: inscricaoMunicipal || null,
        endereco: fullEndereco || null,
        cep: cep || null,
        telefone_comercial: telefone || null,
        email_comercial: emailEmpresa || null,
      });
    });
  }

  res.status(201).json({ tenant, admin });
});

router.get("/tenants/:id/empresa", (req, res) => {
  const tenant = getTenantById(req.params.id);
  if (!tenant) {
    res.status(404).json({ error: "Empresa não encontrada" });
    return;
  }
  tenantContext.run({ tenantId: tenant.id, tenantSlug: tenant.slug }, () => {
    const db = getTenantDb(tenant.slug);
    const row = db.prepare("SELECT * FROM tenant_config LIMIT 1").get() as Record<string, unknown> | undefined;
    if (!row) {
      res.json({});
      return;
    }
    res.json({
      cnpj: row.cnpj || "",
      inscricaoMunicipal: row.inscricao_municipal || "",
      endereco: row.endereco || "",
      cep: row.cep || "",
      telefone: row.telefone_comercial || "",
      emailEmpresa: row.email_comercial || "",
    });
  });
});

router.put("/tenants/:id", (req, res) => {
  const tenant = getTenantById(req.params.id);
  if (!tenant) {
    res.status(404).json({ error: "Empresa não encontrada" });
    return;
  }
  const { name, slug, cnpj, inscricaoMunicipal, endereco, cep, municipio, uf, telefone, emailEmpresa } = req.body || {};
  const updated = updateTenant(req.params.id, { name, slug });
  if (!updated) {
    res.status(404).json({ error: "Empresa não encontrada" });
    return;
  }

  const hasCompanyData = cnpj !== undefined || inscricaoMunicipal !== undefined || endereco !== undefined || cep !== undefined || telefone !== undefined || emailEmpresa !== undefined;
  if (hasCompanyData) {
    tenantContext.run({ tenantId: updated.id, tenantSlug: updated.slug }, () => {
      const db = getTenantDb(updated.slug);
      const row = db.prepare("SELECT user_id FROM tenant_config LIMIT 1").get() as { user_id: string } | undefined;
      const configUserId = row?.user_id || req.session.appUser!.id;
      const fullEndereco = municipio || uf
        ? [endereco, municipio && uf ? `${municipio}/${uf}` : municipio || uf].filter(Boolean).join(" — ")
        : endereco;
      upsertTenantConfig(configUserId, {
        cnpj: cnpj !== undefined ? (String(cnpj).replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") || null) : undefined,
        inscricao_municipal: inscricaoMunicipal !== undefined ? (inscricaoMunicipal || null) : undefined,
        endereco: fullEndereco !== undefined ? (fullEndereco || null) : undefined,
        cep: cep !== undefined ? (cep || null) : undefined,
        telefone_comercial: telefone !== undefined ? (telefone || null) : undefined,
        email_comercial: emailEmpresa !== undefined ? (emailEmpresa || null) : undefined,
      });
    });
  }

  res.json({ ...updated, userCount: listMasterUsers(updated.id).length });
});

router.delete("/tenants/:id", (req, res) => {
  const tenant = getTenantById(req.params.id);
  if (!tenant) {
    res.status(404).json({ error: "Empresa não encontrada" });
    return;
  }
  deleteTenant(req.params.id);
  res.status(204).end();
});

// --- Users for a tenant ---

router.get("/tenants/:id/users", (req, res) => {
  const tenant = getTenantById(req.params.id);
  if (!tenant) {
    res.status(404).json({ error: "Empresa não encontrada" });
    return;
  }
  const users = listMasterUsers(tenant.id);
  const profiles = listAccessProfiles(tenant.id);

  const result = users.map(u => {
    const ut = getUserTenants(u.id).find(t => t.tenant_id === tenant.id);
    const profile = ut?.profile_id ? profiles.find(p => p.id === ut.profile_id) : null;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      profileId: ut?.profile_id || null,
      profileName: profile?.name || null,
    };
  });
  res.json(result);
});

router.post("/tenants/:id/users", async (req, res) => {
  const tenant = getTenantById(req.params.id);
  if (!tenant) {
    res.status(404).json({ error: "Empresa não encontrada" });
    return;
  }
  const body = req.body || {};
  const name = requiredString(body.name, "name", 200);
  const email = requiredString(body.email, "email", 254).toLowerCase();
  const password = requiredString(body.password, "password", 128);
  const profileId = optionalString(body.profileId, "profileId", 128);
  if (password.length < 8) {
    res.status(400).json({ error: "Senha deve ter no mínimo 8 caracteres" });
    return;
  }

  const existingUser = getMasterUserByEmail(email);
  if (existingUser) {
    const userTenants = getUserTenants(existingUser.id);
    if (userTenants.some(t => t.tenant_id === tenant.id)) {
      res.status(409).json({ error: "Usuário já pertence a esta empresa" });
      return;
    }
    addUserToTenant(existingUser.id, tenant.id, "colaborador");
    if (profileId) setUserTenantProfile(existingUser.id, tenant.id, profileId);
    res.status(201).json({ id: existingUser.id, name: existingUser.name, email: existingUser.email });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = createMasterUser({
    tenantId: tenant.id,
    name,
    email,
    passwordHash,
    role: "colaborador",
  });
  if (profileId) setUserTenantProfile(user.id, tenant.id, profileId);
  res.status(201).json({ id: user.id, name: user.name, email: user.email });
});

router.put("/tenants/:tenantId/users/:userId/profile", (req, res) => {
  const { profileId } = req.body || {};
  setUserTenantProfile(req.params.userId, req.params.tenantId, profileId || null);
  res.json({ success: true });
});

router.put("/tenants/:tenantId/users/:userId", (req, res) => {
  const { active, name, email } = req.body || {};
  const updates: Record<string, unknown> = {};
  if (active !== undefined) updates.active = active ? 1 : 0;
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (Object.keys(updates).length > 0) {
    updateMasterUser(req.params.userId, updates as any);
  }
  const user = getMasterUserById(req.params.userId);
  res.json(user ? { id: user.id, name: user.name, email: user.email, active: user.active } : { success: true });
});

router.delete("/tenants/:tenantId/users/:userId", (req, res) => {
  removeUserFromTenant(req.params.userId, req.params.tenantId);
  res.status(204).end();
});

// --- Set password (moved from legacy /admin) ---

router.post("/set-password", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "E-mail é obrigatório" });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Senha deve ter no mínimo 8 caracteres" });
    return;
  }
  const user = getUserByEmail(email);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  try {
    await updatePassword(user.id, password);
    res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("Erro ao definir senha:", error);
    res.status(500).json({ error: "Falha ao definir senha" });
  }
});

// --- Platform metrics ---

router.get("/metrics", (_req, res) => {
  const tenants = listTenants();
  const allUsers = listMasterUsers();
  const activeUsers = allUsers.filter(u => u.active === 1);
  res.json({
    totalTenants: tenants.length,
    totalUsers: allUsers.length,
    activeUsers: activeUsers.length,
    tenantsWithUsers: tenants.map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      userCount: allUsers.filter(u => u.tenant_id === t.id).length,
    })),
  });
});

export { router as systemAdminRouter };
