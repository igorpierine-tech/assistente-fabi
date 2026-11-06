import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { masterDbPath } from "../config/persistence";

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
  `);

  // Backfill: ensure every user with a tenant_id has a row in user_tenants
  db.exec(`
    INSERT OR IGNORE INTO user_tenants (user_id, tenant_id, role)
    SELECT id, tenant_id, role FROM users WHERE tenant_id IS NOT NULL
  `);
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
  tenant_name: string;
  tenant_slug: string;
}

export function getUserTenants(userId: string): UserTenantRow[] {
  return getMasterDb()
    .prepare(`
      SELECT ut.user_id, ut.tenant_id, ut.role, ut.active,
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
