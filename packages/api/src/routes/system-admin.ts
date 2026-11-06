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
import { hashPassword } from "../services/users-db";
import { getTenantDb, upsertTenantConfig } from "../services/database";
import { tenantContext } from "../services/tenant-context";
import "../session-types";

const router: ExpressRouter = Router();

router.use((req, res, next) => {
  if (!req.session.appUser) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
});

// --- Modules ---

router.get("/modules", (_req, res) => {
  res.json(SYSTEM_MODULES);
});

router.get("/my-modules", (req, res) => {
  const { id, tenantId } = req.session.appUser!;
  if (!tenantId) {
    res.json(SYSTEM_MODULES.map(m => m.id));
    return;
  }
  const modules = getUserModules(id, tenantId);
  res.json(modules);
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
  const { name, slug, adminName, adminEmail, adminPassword, cnpj, inscricaoMunicipal, endereco, cep, municipio, uf, telefone, emailEmpresa } = req.body || {};
  if (!name || !slug) {
    res.status(400).json({ error: "name e slug são obrigatórios" });
    return;
  }
  const safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9_-]/g, "");
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
        telefone: telefone || null,
        email: emailEmpresa || null,
      });
    });
  }

  res.status(201).json({ tenant, admin });
});

router.put("/tenants/:id", (req, res) => {
  const tenant = getTenantById(req.params.id);
  if (!tenant) {
    res.status(404).json({ error: "Empresa não encontrada" });
    return;
  }
  const { name, slug } = req.body || {};
  const updated = updateTenant(req.params.id, { name, slug });
  if (updated) {
    res.json({ ...updated, userCount: listMasterUsers(updated.id).length });
  } else {
    res.status(404).json({ error: "Empresa não encontrada" });
  }
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
  const { name, email, password, profileId } = req.body || {};
  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email e password são obrigatórios" });
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

export { router as systemAdminRouter };
