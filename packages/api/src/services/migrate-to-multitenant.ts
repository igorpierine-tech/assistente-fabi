import Database from "better-sqlite3";
import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { databasePath, masterDbPath, tenantDbPath } from "../config/persistence";

const RAIZES_SLUG = "raizes";
const RAIZES_NAME = "Raízes e Riquezas";

export function migrateToMultitenant(): void {
  const legacyPath = databasePath();
  const masterPath = masterDbPath();
  const tenantPath = tenantDbPath(RAIZES_SLUG);

  if (!existsSync(legacyPath)) {
    console.log("[migrate] No legacy database found — fresh install, skipping migration");
    return;
  }

  const masterDb = new Database(masterPath);
  const tenantExists = masterDb
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tenants'")
    .get();

  if (tenantExists) {
    const raizes = masterDb
      .prepare("SELECT id FROM tenants WHERE slug = ?")
      .get(RAIZES_SLUG);
    if (raizes) {
      console.log("[migrate] Multi-tenant migration already done — skipping");
      masterDb.close();
      return;
    }
  }

  console.log("[migrate] Starting multi-tenant migration...");

  const legacyDb = new Database(legacyPath, { readonly: true });

  // Check if legacy DB has users table
  const hasUsers = legacyDb
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    .get();
  if (!hasUsers) {
    console.log("[migrate] Legacy DB has no users table — skipping migration");
    legacyDb.close();
    masterDb.close();
    return;
  }

  // Step 1: Copy legacy DB as the tenant DB
  if (!existsSync(tenantPath)) {
    mkdirSync(dirname(tenantPath), { recursive: true });
    copyFileSync(legacyPath, tenantPath);
    // Also copy WAL and SHM files if they exist
    if (existsSync(legacyPath + "-wal")) {
      copyFileSync(legacyPath + "-wal", tenantPath + "-wal");
    }
    if (existsSync(legacyPath + "-shm")) {
      copyFileSync(legacyPath + "-shm", tenantPath + "-shm");
    }
    console.log(`[migrate] Copied legacy DB → ${tenantPath}`);
  }

  // Step 2: Create tenant in master DB
  masterDb.pragma("journal_mode = WAL");
  masterDb.pragma("foreign_keys = ON");

  masterDb.exec(`
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
  `);

  const tenantId = uuidv4();
  masterDb
    .prepare("INSERT INTO tenants (id, slug, name) VALUES (?, ?, ?)")
    .run(tenantId, RAIZES_SLUG, RAIZES_NAME);
  console.log(`[migrate] Created tenant: ${RAIZES_NAME} (${RAIZES_SLUG})`);

  // Step 3: Copy users from legacy DB to master DB
  const legacyUsers = legacyDb
    .prepare("SELECT * FROM users")
    .all() as Array<{
      id: string;
      name: string;
      email: string;
      password_hash: string | null;
      role: string;
      google_id: string | null;
      active: number;
      created_at: string;
      updated_at: string;
    }>;

  const insertUser = masterDb.prepare(
    `INSERT OR IGNORE INTO users (id, tenant_id, name, email, password_hash, role, platform_role, google_id, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const u of legacyUsers) {
    insertUser.run(
      u.id,
      tenantId,
      u.name,
      u.email,
      u.password_hash,
      u.role,
      "user",
      u.google_id,
      u.active,
      u.created_at,
      u.updated_at
    );
  }
  console.log(`[migrate] Migrated ${legacyUsers.length} user(s) to master DB`);

  // Step 4: Copy google_tokens from legacy DB to master DB
  const hasGoogleTokens = legacyDb
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='google_tokens'")
    .get();
  if (hasGoogleTokens) {
    const tokens = legacyDb.prepare("SELECT * FROM google_tokens").all() as Array<{
      user_id: string;
      access_token: string;
      refresh_token: string;
      expiry_date: number | null;
      scope: string | null;
      google_email: string | null;
      connected_at: string;
      updated_at: string;
    }>;

    const insertToken = masterDb.prepare(
      `INSERT OR IGNORE INTO google_tokens (user_id, access_token, refresh_token, expiry_date, scope, google_email, connected_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const t of tokens) {
      insertToken.run(
        t.user_id,
        t.access_token,
        t.refresh_token,
        t.expiry_date,
        t.scope,
        t.google_email,
        t.connected_at,
        t.updated_at
      );
    }
    console.log(`[migrate] Migrated ${tokens.length} Google token(s) to master DB`);
  }

  // Step 5: Drop users and google_tokens from the tenant copy
  const tenantDb = new Database(tenantPath);
  tenantDb.pragma("foreign_keys = OFF");
  try { tenantDb.exec("DROP TABLE IF EXISTS google_tokens"); } catch { /* ok */ }
  try { tenantDb.exec("DROP TABLE IF EXISTS users"); } catch { /* ok */ }
  tenantDb.pragma("foreign_keys = ON");
  tenantDb.close();
  console.log("[migrate] Removed users/google_tokens from tenant DB");

  legacyDb.close();
  masterDb.close();

  console.log("[migrate] Multi-tenant migration complete!");
}
