import { Pool, type PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import type { TenantRow, MasterUserRow, UserTenantRow, AccessProfileRow } from "./master-db";

let pool: Pool;

export function getPgPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL não configurada para PostgreSQL");
    }
    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

export async function initPgTables(): Promise<void> {
  const client = await getPgPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'colaborador',
        platform_role TEXT NOT NULL DEFAULT 'user',
        google_id TEXT UNIQUE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_pg_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_pg_users_tenant ON users(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_pg_users_google ON users(google_id);

      CREATE TABLE IF NOT EXISTS google_tokens (
        user_id UUID PRIMARY KEY REFERENCES users(id),
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expiry_date BIGINT,
        scope TEXT,
        google_email TEXT,
        connected_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_tenants (
        user_id UUID NOT NULL REFERENCES users(id),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        role TEXT NOT NULL DEFAULT 'colaborador',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        profile_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, tenant_id)
      );

      CREATE INDEX IF NOT EXISTS idx_pg_user_tenants_user ON user_tenants(user_id);
      CREATE INDEX IF NOT EXISTS idx_pg_user_tenants_tenant ON user_tenants(tenant_id);

      CREATE TABLE IF NOT EXISTS access_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        name TEXT NOT NULL,
        modules JSONB NOT NULL DEFAULT '[]',
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_pg_access_profiles_tenant ON access_profiles(tenant_id);

      CREATE TABLE IF NOT EXISTS plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        modules TEXT[] NOT NULL,
        max_users INTEGER,
        price_cents INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
        plan_id UUID NOT NULL REFERENCES plans(id),
        status TEXT NOT NULL DEFAULT 'trial',
        trial_ends_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        blocked_at TIMESTAMPTZ,
        blocked_reason TEXT,
        cancelled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

// --- Helper to convert PG rows to match SQLite interface ---

function toBoolInt(val: boolean | null | undefined): number {
  return val ? 1 : 0;
}

function toTenantRow(row: Record<string, unknown>): TenantRow {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    active: toBoolInt(row.active as boolean),
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
  };
}

function toMasterUserRow(row: Record<string, unknown>): MasterUserRow {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    name: row.name as string,
    email: row.email as string,
    password_hash: row.password_hash as string | null,
    role: row.role as string,
    platform_role: row.platform_role as string,
    google_id: row.google_id as string | null,
    active: toBoolInt(row.active as boolean),
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
  };
}

// --- Tenant CRUD ---

export async function pgListTenants(): Promise<TenantRow[]> {
  const { rows } = await getPgPool().query("SELECT * FROM tenants WHERE active = TRUE ORDER BY name");
  return rows.map(toTenantRow);
}

export async function pgGetTenantById(id: string): Promise<TenantRow | undefined> {
  const { rows } = await getPgPool().query("SELECT * FROM tenants WHERE id = $1", [id]);
  return rows[0] ? toTenantRow(rows[0]) : undefined;
}

export async function pgGetTenantBySlug(slug: string): Promise<TenantRow | undefined> {
  const { rows } = await getPgPool().query("SELECT * FROM tenants WHERE slug = $1", [slug]);
  return rows[0] ? toTenantRow(rows[0]) : undefined;
}

export async function pgCreateTenant(data: { name: string; slug: string }): Promise<TenantRow> {
  const id = uuidv4();
  const safeSlug = data.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  await getPgPool().query(
    "INSERT INTO tenants (id, slug, name) VALUES ($1, $2, $3)",
    [id, safeSlug, data.name]
  );
  return (await pgGetTenantById(id))!;
}

export async function pgUpdateTenant(
  id: string,
  data: Partial<{ name: string; slug: string; active: number }>
): Promise<TenantRow | undefined> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (data.name !== undefined) { sets.push(`name = $${idx++}`); values.push(data.name); }
  if (data.slug !== undefined) { sets.push(`slug = $${idx++}`); values.push(data.slug); }
  if (data.active !== undefined) { sets.push(`active = $${idx++}`); values.push(data.active === 1); }
  if (sets.length === 0) return pgGetTenantById(id);
  sets.push(`updated_at = NOW()`);
  values.push(id);
  await getPgPool().query(`UPDATE tenants SET ${sets.join(", ")} WHERE id = $${idx}`, values);
  return pgGetTenantById(id);
}

export async function pgDeleteTenant(id: string): Promise<boolean> {
  await getPgPool().query("UPDATE tenants SET active = FALSE, updated_at = NOW() WHERE id = $1", [id]);
  return true;
}

// --- User CRUD ---

export async function pgGetMasterUserByEmail(email: string): Promise<MasterUserRow | undefined> {
  const { rows } = await getPgPool().query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [email]);
  return rows[0] ? toMasterUserRow(rows[0]) : undefined;
}

export async function pgGetMasterUserById(id: string): Promise<MasterUserRow | undefined> {
  const { rows } = await getPgPool().query("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0] ? toMasterUserRow(rows[0]) : undefined;
}

export async function pgGetMasterUserByGoogleId(googleId: string): Promise<MasterUserRow | undefined> {
  const { rows } = await getPgPool().query("SELECT * FROM users WHERE google_id = $1", [googleId]);
  return rows[0] ? toMasterUserRow(rows[0]) : undefined;
}

export async function pgListMasterUsers(tenantId?: string): Promise<MasterUserRow[]> {
  if (tenantId) {
    const { rows } = await getPgPool().query("SELECT * FROM users WHERE tenant_id = $1 ORDER BY name", [tenantId]);
    return rows.map(toMasterUserRow);
  }
  const { rows } = await getPgPool().query("SELECT * FROM users ORDER BY name");
  return rows.map(toMasterUserRow);
}

export async function pgCreateMasterUser(data: {
  tenantId: string;
  name: string;
  email: string;
  passwordHash?: string | null;
  role?: string;
  platformRole?: string;
  googleId?: string;
}): Promise<MasterUserRow> {
  const id = uuidv4();
  const role = data.role || "colaborador";
  const p = getPgPool();
  await p.query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, role, platform_role, google_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, data.tenantId, data.name, data.email.toLowerCase(), data.passwordHash || null, role, data.platformRole || "user", data.googleId || null]
  );
  await p.query(
    "INSERT INTO user_tenants (user_id, tenant_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    [id, data.tenantId, role]
  );
  return (await pgGetMasterUserById(id))!;
}

export async function pgUpdateMasterUser(
  id: string,
  data: Partial<{ name: string; email: string; role: string; active: number; googleId: string; passwordHash: string }>
): Promise<MasterUserRow | undefined> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (data.name !== undefined) { sets.push(`name = $${idx++}`); values.push(data.name); }
  if (data.email !== undefined) { sets.push(`email = $${idx++}`); values.push(data.email.toLowerCase()); }
  if (data.role !== undefined) { sets.push(`role = $${idx++}`); values.push(data.role); }
  if (data.active !== undefined) { sets.push(`active = $${idx++}`); values.push(data.active === 1); }
  if (data.googleId !== undefined) { sets.push(`google_id = $${idx++}`); values.push(data.googleId); }
  if (data.passwordHash !== undefined) { sets.push(`password_hash = $${idx++}`); values.push(data.passwordHash); }
  if (sets.length === 0) return pgGetMasterUserById(id);
  sets.push(`updated_at = NOW()`);
  values.push(id);
  await getPgPool().query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${idx}`, values);
  return pgGetMasterUserById(id);
}

export async function pgMasterUserCount(tenantId?: string): Promise<number> {
  if (tenantId) {
    const { rows } = await getPgPool().query("SELECT COUNT(*) as cnt FROM users WHERE tenant_id = $1", [tenantId]);
    return parseInt(rows[0].cnt);
  }
  const { rows } = await getPgPool().query("SELECT COUNT(*) as cnt FROM users");
  return parseInt(rows[0].cnt);
}

// --- User ↔ Tenant ---

export async function pgGetUserTenants(userId: string): Promise<UserTenantRow[]> {
  const { rows } = await getPgPool().query(`
    SELECT ut.user_id, ut.tenant_id, ut.role, ut.active::int as active, ut.profile_id,
           t.name AS tenant_name, t.slug AS tenant_slug
    FROM user_tenants ut
    JOIN tenants t ON t.id = ut.tenant_id
    WHERE ut.user_id = $1 AND ut.active = TRUE AND t.active = TRUE
    ORDER BY t.name
  `, [userId]);
  return rows.map(r => ({
    user_id: r.user_id,
    tenant_id: r.tenant_id,
    role: r.role,
    active: r.active,
    profile_id: r.profile_id,
    tenant_name: r.tenant_name,
    tenant_slug: r.tenant_slug,
  }));
}

export async function pgAddUserToTenant(userId: string, tenantId: string, role = "colaborador"): Promise<void> {
  await getPgPool().query(
    "INSERT INTO user_tenants (user_id, tenant_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    [userId, tenantId, role]
  );
}

export async function pgRemoveUserFromTenant(userId: string, tenantId: string): Promise<void> {
  await getPgPool().query(
    "UPDATE user_tenants SET active = FALSE WHERE user_id = $1 AND tenant_id = $2",
    [userId, tenantId]
  );
}

export async function pgSetUserTenantProfile(userId: string, tenantId: string, profileId: string | null): Promise<void> {
  await getPgPool().query(
    "UPDATE user_tenants SET profile_id = $1 WHERE user_id = $2 AND tenant_id = $3",
    [profileId, userId, tenantId]
  );
}

// --- Access Profiles ---

function toAccessProfileRow(row: Record<string, unknown>): AccessProfileRow {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    name: row.name as string,
    modules: typeof row.modules === "string" ? row.modules : JSON.stringify(row.modules),
    is_default: toBoolInt(row.is_default as boolean),
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
  };
}

export async function pgListAccessProfiles(tenantId: string): Promise<AccessProfileRow[]> {
  const { rows } = await getPgPool().query(
    "SELECT * FROM access_profiles WHERE tenant_id = $1 ORDER BY is_default DESC, name",
    [tenantId]
  );
  return rows.map(toAccessProfileRow);
}

export async function pgGetAccessProfileById(id: string): Promise<AccessProfileRow | undefined> {
  const { rows } = await getPgPool().query("SELECT * FROM access_profiles WHERE id = $1", [id]);
  return rows[0] ? toAccessProfileRow(rows[0]) : undefined;
}

export async function pgCreateAccessProfile(data: { tenantId: string; name: string; modules: string[] }): Promise<AccessProfileRow> {
  const id = uuidv4();
  await getPgPool().query(
    "INSERT INTO access_profiles (id, tenant_id, name, modules) VALUES ($1, $2, $3, $4)",
    [id, data.tenantId, data.name, JSON.stringify(data.modules)]
  );
  return (await pgGetAccessProfileById(id))!;
}

export async function pgUpdateAccessProfile(id: string, data: { name?: string; modules?: string[] }): Promise<AccessProfileRow | undefined> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (data.name !== undefined) { sets.push(`name = $${idx++}`); values.push(data.name); }
  if (data.modules !== undefined) { sets.push(`modules = $${idx++}`); values.push(JSON.stringify(data.modules)); }
  if (sets.length === 0) return pgGetAccessProfileById(id);
  sets.push(`updated_at = NOW()`);
  values.push(id);
  await getPgPool().query(`UPDATE access_profiles SET ${sets.join(", ")} WHERE id = $${idx}`, values);
  return pgGetAccessProfileById(id);
}

export async function pgDeleteAccessProfile(id: string): Promise<boolean> {
  const profile = await pgGetAccessProfileById(id);
  if (!profile || profile.is_default) return false;
  await getPgPool().query("UPDATE user_tenants SET profile_id = NULL WHERE profile_id = $1", [id]);
  await getPgPool().query("DELETE FROM access_profiles WHERE id = $1", [id]);
  return true;
}

export async function pgGetUserModules(userId: string, tenantId: string): Promise<string[]> {
  const { rows } = await getPgPool().query(`
    SELECT ap.modules
    FROM user_tenants ut
    JOIN access_profiles ap ON ap.id = ut.profile_id
    WHERE ut.user_id = $1 AND ut.tenant_id = $2 AND ut.active = TRUE
  `, [userId, tenantId]);

  if (rows[0]) {
    const modules = rows[0].modules;
    return Array.isArray(modules) ? modules : JSON.parse(modules);
  }

  const { rows: defaultRows } = await getPgPool().query(
    "SELECT modules FROM access_profiles WHERE tenant_id = $1 AND is_default = TRUE LIMIT 1",
    [tenantId]
  );

  if (defaultRows[0]) {
    const modules = defaultRows[0].modules;
    return Array.isArray(modules) ? modules : JSON.parse(modules);
  }

  const { SYSTEM_MODULES } = await import("./master-db");
  return SYSTEM_MODULES.map(m => m.id);
}

export async function pgSeedDefaultProfiles(tenantId: string): Promise<void> {
  const { rows } = await getPgPool().query(
    "SELECT 1 FROM access_profiles WHERE tenant_id = $1 LIMIT 1",
    [tenantId]
  );
  if (rows.length > 0) return;

  const profiles = [
    { name: "Administrador", modules: ["inicio","agenda","assistente","clientes","agendamentos","vendas","contratos","financeiro","usuarios","configuracoes","admin"], isDefault: true },
    { name: "Gestor", modules: ["inicio","agenda","assistente","clientes","agendamentos","vendas","contratos","financeiro"], isDefault: false },
    { name: "Colaborador", modules: ["inicio","agenda","clientes","agendamentos"], isDefault: false },
    { name: "Visualizador", modules: ["inicio","financeiro","contratos"], isDefault: false },
  ];
  for (const p of profiles) {
    await getPgPool().query(
      "INSERT INTO access_profiles (id, tenant_id, name, modules, is_default) VALUES ($1, $2, $3, $4, $5)",
      [uuidv4(), tenantId, p.name, JSON.stringify(p.modules), p.isDefault]
    );
  }
}

// --- Plans & Subscriptions ---

export interface PlanRow {
  id: string;
  name: string;
  slug: string;
  modules: string[];
  max_users: number | null;
  price_cents: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRow {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string;
  trial_ends_at: string | null;
  started_at: string;
  blocked_at: string | null;
  blocked_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function pgListPlans(): Promise<PlanRow[]> {
  const { rows } = await getPgPool().query("SELECT * FROM plans WHERE active = TRUE ORDER BY price_cents");
  return rows.map(r => ({
    ...r,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  }));
}

export async function pgGetPlanById(id: string): Promise<PlanRow | undefined> {
  const { rows } = await getPgPool().query("SELECT * FROM plans WHERE id = $1", [id]);
  if (!rows[0]) return undefined;
  return { ...rows[0], created_at: rows[0].created_at.toISOString(), updated_at: rows[0].updated_at.toISOString() };
}

export async function pgCreatePlan(data: { name: string; slug: string; modules: string[]; maxUsers?: number; priceCents?: number }): Promise<PlanRow> {
  const id = uuidv4();
  await getPgPool().query(
    "INSERT INTO plans (id, name, slug, modules, max_users, price_cents) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, data.name, data.slug, data.modules, data.maxUsers || null, data.priceCents || 0]
  );
  return (await pgGetPlanById(id))!;
}

export async function pgUpdatePlan(id: string, data: Partial<{ name: string; modules: string[]; maxUsers: number | null; priceCents: number; active: boolean }>): Promise<PlanRow | undefined> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (data.name !== undefined) { sets.push(`name = $${idx++}`); values.push(data.name); }
  if (data.modules !== undefined) { sets.push(`modules = $${idx++}`); values.push(data.modules); }
  if (data.maxUsers !== undefined) { sets.push(`max_users = $${idx++}`); values.push(data.maxUsers); }
  if (data.priceCents !== undefined) { sets.push(`price_cents = $${idx++}`); values.push(data.priceCents); }
  if (data.active !== undefined) { sets.push(`active = $${idx++}`); values.push(data.active); }
  if (sets.length === 0) return pgGetPlanById(id);
  sets.push(`updated_at = NOW()`);
  values.push(id);
  await getPgPool().query(`UPDATE plans SET ${sets.join(", ")} WHERE id = $${idx}`, values);
  return pgGetPlanById(id);
}

export async function pgGetSubscription(tenantId: string): Promise<SubscriptionRow | undefined> {
  const { rows } = await getPgPool().query("SELECT * FROM subscriptions WHERE tenant_id = $1", [tenantId]);
  if (!rows[0]) return undefined;
  const r = rows[0];
  return {
    ...r,
    trial_ends_at: r.trial_ends_at?.toISOString() || null,
    started_at: r.started_at.toISOString(),
    blocked_at: r.blocked_at?.toISOString() || null,
    cancelled_at: r.cancelled_at?.toISOString() || null,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}

export async function pgCreateSubscription(data: { tenantId: string; planId: string; status?: string; trialEndsAt?: Date }): Promise<SubscriptionRow> {
  const id = uuidv4();
  await getPgPool().query(
    "INSERT INTO subscriptions (id, tenant_id, plan_id, status, trial_ends_at) VALUES ($1, $2, $3, $4, $5)",
    [id, data.tenantId, data.planId, data.status || "trial", data.trialEndsAt || null]
  );
  return (await pgGetSubscription(data.tenantId))!;
}

export async function pgUpdateSubscription(tenantId: string, data: Partial<{ planId: string; status: string; blockedReason: string }>): Promise<SubscriptionRow | undefined> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (data.planId !== undefined) { sets.push(`plan_id = $${idx++}`); values.push(data.planId); }
  if (data.status !== undefined) {
    sets.push(`status = $${idx++}`);
    values.push(data.status);
    if (data.status === "bloqueado") sets.push(`blocked_at = NOW()`);
    if (data.status === "cancelado") sets.push(`cancelled_at = NOW()`);
  }
  if (data.blockedReason !== undefined) { sets.push(`blocked_reason = $${idx++}`); values.push(data.blockedReason); }
  if (sets.length === 0) return pgGetSubscription(tenantId);
  sets.push(`updated_at = NOW()`);
  values.push(tenantId);
  await getPgPool().query(`UPDATE subscriptions SET ${sets.join(", ")} WHERE tenant_id = $${idx}`, values);
  return pgGetSubscription(tenantId);
}

export async function pgGetTenantPlanModules(tenantId: string): Promise<string[]> {
  const { rows } = await getPgPool().query(`
    SELECT p.modules
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.tenant_id = $1 AND s.status IN ('trial', 'ativo')
  `, [tenantId]);
  if (!rows[0]) return [];
  return rows[0].modules;
}

export async function pgGetSubscriptionStatus(tenantId: string): Promise<string | null> {
  const { rows } = await getPgPool().query("SELECT status FROM subscriptions WHERE tenant_id = $1", [tenantId]);
  return rows[0]?.status || null;
}
