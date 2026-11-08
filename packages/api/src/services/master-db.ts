import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { masterDbPath } from "../config/persistence";

export const MASTER_DB_TYPE = process.env.MASTER_DB_TYPE || "sqlite";
export const isPostgres = MASTER_DB_TYPE === "postgresql";

let masterDb: Database.Database;

export interface TenantRow {
  id: string;
  slug: string;
  name: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface MasterUserRow {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  password_hash: string | null;
  role: string;
  platform_role: string;
  google_id: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export function getMasterDb(): Database.Database {
  if (!masterDb) {
    const dbPath = masterDbPath();
    mkdirSync(dirname(dbPath), { recursive: true });
    masterDb = new Database(dbPath);
    masterDb.pragma("journal_mode = WAL");
    masterDb.pragma("foreign_keys = ON");
    initMasterTables(masterDb);
  }
  return masterDb;
}

function initMasterTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'colaborador',
      platform_role TEXT NOT NULL DEFAULT 'user',
      google_id TEXT UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_master_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_master_users_tenant ON users(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_master_users_google ON users(google_id);

    CREATE TABLE IF NOT EXISTS google_tokens (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expiry_date INTEGER,
      scope TEXT,
      google_email TEXT,
      connected_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_tenants (
      user_id TEXT NOT NULL REFERENCES users(id),
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      role TEXT NOT NULL DEFAULT 'colaborador',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, tenant_id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_tenants_user ON user_tenants(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant ON user_tenants(tenant_id);

    CREATE TABLE IF NOT EXISTS access_profiles (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      name TEXT NOT NULL,
      modules TEXT NOT NULL DEFAULT '[]',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_access_profiles_tenant ON access_profiles(tenant_id);

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      modules TEXT NOT NULL DEFAULT '[]',
      max_users INTEGER,
      price_cents INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) UNIQUE,
      plan_id TEXT NOT NULL REFERENCES plans(id),
      status TEXT NOT NULL DEFAULT 'trial',
      trial_ends_at TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      blocked_at TEXT,
      blocked_reason TEXT,
      cancelled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_id);
  `);

  seedDefaultPlans(db);

  // Bootstrap super admin from env var
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  if (superAdminEmail) {
    db.prepare(
      "UPDATE users SET platform_role = 'super_admin', updated_at = datetime('now') WHERE email = ? COLLATE NOCASE AND platform_role != 'super_admin'"
    ).run(superAdminEmail.toLowerCase());
  }

  // Add profile_id column to user_tenants if not present
  try {
    db.exec("ALTER TABLE user_tenants ADD COLUMN profile_id TEXT REFERENCES access_profiles(id)");
  } catch {
    // column already exists
  }

  // Backfill: ensure every user with a tenant_id has a row in user_tenants
  db.exec(`
    INSERT OR IGNORE INTO user_tenants (user_id, tenant_id, role)
    SELECT id, tenant_id, role FROM users WHERE tenant_id IS NOT NULL
  `);

  // Seed default profiles for each tenant that has none
  const tenantsWithout = db.prepare(`
    SELECT t.id, t.slug FROM tenants t
    WHERE NOT EXISTS (SELECT 1 FROM access_profiles ap WHERE ap.tenant_id = t.id)
  `).all() as { id: string; slug: string }[];
  for (const t of tenantsWithout) {
    seedDefaultProfiles(db, t.id);
  }
}

// --- Tenant CRUD ---

export function listTenants(): TenantRow[] {
  return getMasterDb()
    .prepare("SELECT * FROM tenants WHERE active = 1 ORDER BY name")
    .all() as TenantRow[];
}

export function getTenantById(id: string): TenantRow | undefined {
  return getMasterDb()
    .prepare("SELECT * FROM tenants WHERE id = ?")
    .get(id) as TenantRow | undefined;
}

export function getTenantBySlug(slug: string): TenantRow | undefined {
  return getMasterDb()
    .prepare("SELECT * FROM tenants WHERE slug = ?")
    .get(slug) as TenantRow | undefined;
}

export function createTenant(data: { name: string; slug: string }): TenantRow {
  const id = uuidv4();
  getMasterDb()
    .prepare("INSERT INTO tenants (id, slug, name) VALUES (?, ?, ?)")
    .run(id, data.slug.toLowerCase().replace(/[^a-z0-9_-]/g, ""), data.name);
  return getTenantById(id)!;
}

export function updateTenant(
  id: string,
  data: Partial<{ name: string; slug: string; active: number }>
): TenantRow | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
  if (data.slug !== undefined) { fields.push("slug = ?"); values.push(data.slug); }
  if (data.active !== undefined) { fields.push("active = ?"); values.push(data.active); }
  if (fields.length === 0) return getTenantById(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  getMasterDb().prepare(`UPDATE tenants SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getTenantById(id);
}

export function deleteTenant(id: string): boolean {
  getMasterDb().prepare("UPDATE tenants SET active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  return true;
}

// --- User CRUD (master level) ---

export function getMasterUserByEmail(email: string): MasterUserRow | undefined {
  return getMasterDb()
    .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .get(email) as MasterUserRow | undefined;
}

export function getMasterUserById(id: string): MasterUserRow | undefined {
  return getMasterDb()
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(id) as MasterUserRow | undefined;
}

export function getMasterUserByGoogleId(googleId: string): MasterUserRow | undefined {
  return getMasterDb()
    .prepare("SELECT * FROM users WHERE google_id = ?")
    .get(googleId) as MasterUserRow | undefined;
}

export function listMasterUsers(tenantId?: string): MasterUserRow[] {
  if (tenantId) {
    return getMasterDb()
      .prepare("SELECT * FROM users WHERE tenant_id = ? ORDER BY name")
      .all(tenantId) as MasterUserRow[];
  }
  return getMasterDb()
    .prepare("SELECT * FROM users ORDER BY name")
    .all() as MasterUserRow[];
}

export function createMasterUser(data: {
  tenantId: string;
  name: string;
  email: string;
  passwordHash?: string | null;
  role?: string;
  platformRole?: string;
  googleId?: string;
}): MasterUserRow {
  const id = uuidv4();
  const role = data.role || "colaborador";
  const db = getMasterDb();
  db.prepare(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, role, platform_role, google_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.tenantId,
    data.name,
    data.email.toLowerCase(),
    data.passwordHash || null,
    role,
    data.platformRole || "user",
    data.googleId || null
  );
  // Also insert into user_tenants junction table
  db.prepare(
    "INSERT OR IGNORE INTO user_tenants (user_id, tenant_id, role) VALUES (?, ?, ?)"
  ).run(id, data.tenantId, role);
  return getMasterUserById(id)!;
}

export function updateMasterUser(
  id: string,
  data: Partial<{
    name: string;
    email: string;
    role: string;
    active: number;
    googleId: string;
    passwordHash: string;
  }>
): MasterUserRow | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
  if (data.email !== undefined) { fields.push("email = ?"); values.push(data.email.toLowerCase()); }
  if (data.role !== undefined) { fields.push("role = ?"); values.push(data.role); }
  if (data.active !== undefined) { fields.push("active = ?"); values.push(data.active); }
  if (data.googleId !== undefined) { fields.push("google_id = ?"); values.push(data.googleId); }
  if (data.passwordHash !== undefined) { fields.push("password_hash = ?"); values.push(data.passwordHash); }
  if (fields.length === 0) return getMasterUserById(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  getMasterDb().prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getMasterUserById(id);
}

export function masterUserCount(tenantId?: string): number {
  if (tenantId) {
    return (getMasterDb().prepare("SELECT COUNT(*) as cnt FROM users WHERE tenant_id = ?").get(tenantId) as { cnt: number }).cnt;
  }
  return (getMasterDb().prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number }).cnt;
}

// --- User ↔ Tenant (N:N) ---

export interface UserTenantRow {
  user_id: string;
  tenant_id: string;
  role: string;
  active: number;
  profile_id: string | null;
  tenant_name: string;
  tenant_slug: string;
}

export function getUserTenants(userId: string): UserTenantRow[] {
  return getMasterDb()
    .prepare(`
      SELECT ut.user_id, ut.tenant_id, ut.role, ut.active, ut.profile_id,
             t.name AS tenant_name, t.slug AS tenant_slug
      FROM user_tenants ut
      JOIN tenants t ON t.id = ut.tenant_id
      WHERE ut.user_id = ? AND ut.active = 1 AND t.active = 1
      ORDER BY t.name
    `)
    .all(userId) as UserTenantRow[];
}

export function addUserToTenant(userId: string, tenantId: string, role: string = "colaborador"): void {
  getMasterDb()
    .prepare("INSERT OR IGNORE INTO user_tenants (user_id, tenant_id, role) VALUES (?, ?, ?)")
    .run(userId, tenantId, role);
}

export function removeUserFromTenant(userId: string, tenantId: string): void {
  getMasterDb()
    .prepare("UPDATE user_tenants SET active = 0 WHERE user_id = ? AND tenant_id = ?")
    .run(userId, tenantId);
}

export function setUserTenantProfile(userId: string, tenantId: string, profileId: string | null): void {
  getMasterDb()
    .prepare("UPDATE user_tenants SET profile_id = ? WHERE user_id = ? AND tenant_id = ?")
    .run(profileId, userId, tenantId);
}

// --- System modules definition ---

export const SYSTEM_MODULES = [
  { id: "inicio", label: "Início", description: "Dashboard principal" },
  { id: "agenda", label: "Agenda", description: "Gestão de agendamentos" },
  { id: "assistente", label: "Assistente IA", description: "Assistente de inteligência artificial" },
  { id: "clientes", label: "Clientes", description: "Cadastro e gestão de clientes" },
  { id: "agendamentos", label: "Agendamentos", description: "Solicitações de agendamento" },
  { id: "vendas", label: "Vendas", description: "Gestão de vendas" },
  { id: "contratos", label: "Contratos", description: "Gestão de contratos" },
  { id: "financeiro", label: "Financeiro", description: "Gestão financeira" },
  { id: "usuarios", label: "Usuários", description: "Gestão de usuários da empresa" },
  { id: "configuracoes", label: "Configurações", description: "Configurações da empresa" },
  { id: "admin", label: "Administração", description: "Administração do sistema (empresas, usuários e perfis)" },
] as const;

export type ModuleId = typeof SYSTEM_MODULES[number]["id"];

// --- Access Profiles ---

export interface AccessProfileRow {
  id: string;
  tenant_id: string;
  name: string;
  modules: string; // JSON array of module ids
  is_default: number;
  created_at: string;
  updated_at: string;
}

function seedDefaultProfiles(db: Database.Database, tenantId: string) {
  const profiles = [
    { name: "Administrador", modules: ["inicio","agenda","assistente","clientes","agendamentos","vendas","contratos","financeiro","usuarios","configuracoes","admin"], isDefault: 1 },
    { name: "Gestor", modules: ["inicio","agenda","assistente","clientes","agendamentos","vendas","contratos","financeiro"], isDefault: 0 },
    { name: "Colaborador", modules: ["inicio","agenda","clientes","agendamentos"], isDefault: 0 },
    { name: "Visualizador", modules: ["inicio","financeiro","contratos"], isDefault: 0 },
  ];
  const stmt = db.prepare(
    "INSERT INTO access_profiles (id, tenant_id, name, modules, is_default) VALUES (?, ?, ?, ?, ?)"
  );
  for (const p of profiles) {
    stmt.run(uuidv4(), tenantId, p.name, JSON.stringify(p.modules), p.isDefault);
  }
}

export function listAccessProfiles(tenantId: string): AccessProfileRow[] {
  return getMasterDb()
    .prepare("SELECT * FROM access_profiles WHERE tenant_id = ? ORDER BY is_default DESC, name")
    .all(tenantId) as AccessProfileRow[];
}

export function getAccessProfileById(id: string): AccessProfileRow | undefined {
  return getMasterDb()
    .prepare("SELECT * FROM access_profiles WHERE id = ?")
    .get(id) as AccessProfileRow | undefined;
}

export function createAccessProfile(data: { tenantId: string; name: string; modules: string[] }): AccessProfileRow {
  const id = uuidv4();
  getMasterDb()
    .prepare("INSERT INTO access_profiles (id, tenant_id, name, modules) VALUES (?, ?, ?, ?)")
    .run(id, data.tenantId, data.name, JSON.stringify(data.modules));
  return getAccessProfileById(id)!;
}

export function updateAccessProfile(id: string, data: { name?: string; modules?: string[] }): AccessProfileRow | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
  if (data.modules !== undefined) { fields.push("modules = ?"); values.push(JSON.stringify(data.modules)); }
  if (fields.length === 0) return getAccessProfileById(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  getMasterDb().prepare(`UPDATE access_profiles SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getAccessProfileById(id);
}

export function deleteAccessProfile(id: string): boolean {
  const profile = getAccessProfileById(id);
  if (!profile || profile.is_default) return false;
  getMasterDb().prepare("UPDATE user_tenants SET profile_id = NULL WHERE profile_id = ?").run(id);
  getMasterDb().prepare("DELETE FROM access_profiles WHERE id = ?").run(id);
  return true;
}

export function getUserModules(userId: string, tenantId: string): string[] {
  // Get profile modules
  const row = getMasterDb().prepare(`
    SELECT ap.modules
    FROM user_tenants ut
    JOIN access_profiles ap ON ap.id = ut.profile_id
    WHERE ut.user_id = ? AND ut.tenant_id = ? AND ut.active = 1
  `).get(userId, tenantId) as { modules: string } | undefined;

  let profileModules: string[];
  if (row) {
    profileModules = JSON.parse(row.modules) as string[];
  } else {
    const defaultProfile = getMasterDb().prepare(
      "SELECT modules FROM access_profiles WHERE tenant_id = ? AND is_default = 1 LIMIT 1"
    ).get(tenantId) as { modules: string } | undefined;
    profileModules = defaultProfile
      ? JSON.parse(defaultProfile.modules) as string[]
      : SYSTEM_MODULES.map(m => m.id);
  }

  // Get plan modules for this tenant's subscription
  const planModules = getTenantPlanModules(tenantId);
  if (!planModules) return profileModules;

  // Return intersection of plan modules and profile modules
  return profileModules.filter(m => planModules.includes(m));
}

function getTenantPlanModules(tenantId: string): string[] | null {
  const sub = getMasterDb().prepare(`
    SELECT p.modules FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.tenant_id = ? AND s.status IN ('trial', 'ativo')
  `).get(tenantId) as { modules: string } | undefined;
  if (!sub) return null;
  return JSON.parse(sub.modules) as string[];
}

// --- Plans ---

export interface PlanRow {
  id: string;
  name: string;
  slug: string;
  modules: string; // JSON array
  max_users: number | null;
  price_cents: number;
  active: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PLANS = [
  {
    slug: "starter",
    name: "Starter",
    modules: ["inicio", "agenda", "clientes", "agendamentos"],
    max_users: 3,
    price_cents: 0,
  },
  {
    slug: "professional",
    name: "Professional",
    modules: ["inicio", "agenda", "assistente", "clientes", "agendamentos", "vendas", "contratos", "financeiro"],
    max_users: 10,
    price_cents: 9900,
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    modules: SYSTEM_MODULES.map(m => m.id),
    max_users: null,
    price_cents: 19900,
  },
] as const;

function seedDefaultPlans(db: Database.Database) {
  const count = db.prepare("SELECT COUNT(*) as c FROM plans").get() as { c: number };
  if (count.c > 0) return;
  const stmt = db.prepare(
    "INSERT INTO plans (id, slug, name, modules, max_users, price_cents) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const p of DEFAULT_PLANS) {
    stmt.run(uuidv4(), p.slug, p.name, JSON.stringify(p.modules), p.max_users, p.price_cents);
  }
}

export function listPlans(): PlanRow[] {
  return getMasterDb()
    .prepare("SELECT * FROM plans ORDER BY price_cents ASC")
    .all() as PlanRow[];
}

export function getPlanById(id: string): PlanRow | undefined {
  return getMasterDb()
    .prepare("SELECT * FROM plans WHERE id = ?")
    .get(id) as PlanRow | undefined;
}

export function getPlanBySlug(slug: string): PlanRow | undefined {
  return getMasterDb()
    .prepare("SELECT * FROM plans WHERE slug = ?")
    .get(slug) as PlanRow | undefined;
}

export function createPlan(data: { name: string; slug: string; modules: string[]; maxUsers?: number | null; priceCents?: number }): PlanRow {
  const id = uuidv4();
  getMasterDb()
    .prepare("INSERT INTO plans (id, slug, name, modules, max_users, price_cents) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, data.slug, data.name, JSON.stringify(data.modules), data.maxUsers ?? null, data.priceCents ?? 0);
  return getPlanById(id)!;
}

export function updatePlan(id: string, data: { name?: string; slug?: string; modules?: string[]; maxUsers?: number | null; priceCents?: number; active?: number }): PlanRow | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
  if (data.slug !== undefined) { fields.push("slug = ?"); values.push(data.slug); }
  if (data.modules !== undefined) { fields.push("modules = ?"); values.push(JSON.stringify(data.modules)); }
  if (data.maxUsers !== undefined) { fields.push("max_users = ?"); values.push(data.maxUsers); }
  if (data.priceCents !== undefined) { fields.push("price_cents = ?"); values.push(data.priceCents); }
  if (data.active !== undefined) { fields.push("active = ?"); values.push(data.active); }
  if (fields.length === 0) return getPlanById(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  getMasterDb().prepare(`UPDATE plans SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getPlanById(id);
}

// --- Subscriptions ---

export interface SubscriptionRow {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string; // trial | ativo | bloqueado | cancelado
  trial_ends_at: string | null;
  started_at: string;
  blocked_at: string | null;
  blocked_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export function getSubscriptionByTenant(tenantId: string): SubscriptionRow | undefined {
  return getMasterDb()
    .prepare("SELECT * FROM subscriptions WHERE tenant_id = ?")
    .get(tenantId) as SubscriptionRow | undefined;
}

export function listSubscriptions(): SubscriptionRow[] {
  return getMasterDb()
    .prepare("SELECT * FROM subscriptions ORDER BY created_at DESC")
    .all() as SubscriptionRow[];
}

export function createSubscription(data: { tenantId: string; planId: string; status?: string; trialEndsAt?: string }): SubscriptionRow {
  const id = uuidv4();
  getMasterDb()
    .prepare("INSERT INTO subscriptions (id, tenant_id, plan_id, status, trial_ends_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, data.tenantId, data.planId, data.status || "trial", data.trialEndsAt || null);
  return getMasterDb().prepare("SELECT * FROM subscriptions WHERE id = ?").get(id) as SubscriptionRow;
}

export function updateSubscription(id: string, data: { planId?: string; status?: string; blockedReason?: string }): SubscriptionRow | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.planId !== undefined) { fields.push("plan_id = ?"); values.push(data.planId); }
  if (data.status !== undefined) {
    fields.push("status = ?");
    values.push(data.status);
    if (data.status === "bloqueado") {
      fields.push("blocked_at = datetime('now')");
      if (data.blockedReason) { fields.push("blocked_reason = ?"); values.push(data.blockedReason); }
    }
    if (data.status === "cancelado") { fields.push("cancelled_at = datetime('now')"); }
    if (data.status === "ativo") { fields.push("blocked_at = NULL, blocked_reason = NULL, cancelled_at = NULL"); }
  }
  if (fields.length === 0) return getMasterDb().prepare("SELECT * FROM subscriptions WHERE id = ?").get(id) as SubscriptionRow | undefined;
  fields.push("updated_at = datetime('now')");
  values.push(id);
  getMasterDb().prepare(`UPDATE subscriptions SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getMasterDb().prepare("SELECT * FROM subscriptions WHERE id = ?").get(id) as SubscriptionRow | undefined;
}
