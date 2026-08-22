import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { databasePath } from "../config/persistence";

const DB_PATH = databasePath();

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initTables(db);
  }
  return db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'outro',
      client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
      client_name TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      notes TEXT,
      google_event_id TEXT,
      status TEXT NOT NULL DEFAULT 'previsto',
      reminders TEXT DEFAULT '[1440,60]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_time);
    CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_google ON appointments(google_event_id);

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT,
      user_email TEXT,
      title TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

    CREATE TABLE IF NOT EXISTS booking_settings (
      user_id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL DEFAULT 'Agende sua sessão',
      intro TEXT,
      timezone TEXT NOT NULL DEFAULT 'America/Cuiaba',
      work_hours TEXT NOT NULL DEFAULT '{"1":[["09:00","18:00"]],"2":[["09:00","18:00"]],"3":[["09:00","18:00"]],"4":[["09:00","18:00"]],"5":[["09:00","18:00"]],"6":[],"0":[]}',
      buffer_minutes INTEGER NOT NULL DEFAULT 15,
      max_advance_days INTEGER NOT NULL DEFAULT 60,
      min_notice_hours INTEGER NOT NULL DEFAULT 6,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS booking_session_types (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      duration_minutes INTEGER NOT NULL,
      color TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, slug)
    );

    CREATE TABLE IF NOT EXISTS booking_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_type_id TEXT REFERENCES booking_session_types(id) ON DELETE SET NULL,
      session_type_name TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      client_phone TEXT,
      client_notes TEXT,
      requested_start TEXT NOT NULL,
      requested_end TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      google_event_id TEXT,
      manage_token TEXT UNIQUE NOT NULL,
      responded_at TEXT,
      responded_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_booking_requests_user_status ON booking_requests(user_id, status, requested_start);
    CREATE INDEX IF NOT EXISTS idx_booking_types_user ON booking_session_types(user_id, active, sort_order);

    CREATE TABLE IF NOT EXISTS catalog_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      kind TEXT NOT NULL DEFAULT 'servico',
      price_cents INTEGER NOT NULL DEFAULT 0,
      duration_minutes INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_catalog_user ON catalog_items(user_id, sort_order);

    CREATE TABLE IF NOT EXISTS receivables (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
      catalog_item_id TEXT REFERENCES catalog_items(id) ON DELETE SET NULL,
      client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
      client_name TEXT NOT NULL,
      item_name TEXT NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      service_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      paid_at TEXT,
      payment_method TEXT,
      status TEXT NOT NULL DEFAULT 'pendente',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_receivables_user_status ON receivables(user_id, status, due_date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_receivables_appointment
      ON receivables(appointment_id) WHERE appointment_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
      client_name TEXT NOT NULL,
      client_document TEXT,
      client_email TEXT,
      client_phone TEXT,
      catalog_item_id TEXT REFERENCES catalog_items(id) ON DELETE SET NULL,
      item_name TEXT NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT,
      installments INTEGER NOT NULL DEFAULT 1,
      sale_date TEXT NOT NULL,
      notes TEXT,
      contract_generated_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sales_user_date ON sales(user_id, sale_date DESC);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS privacy_consents (
      user_id TEXT NOT NULL,
      version TEXT NOT NULL,
      accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at TEXT,
      PRIMARY KEY (user_id, version)
    );

    CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_logs(user_id, created_at);
  `);

  // Existing databases predate multi-tenancy. Legacy rows are deliberately
  // quarantined instead of being assigned to the first user who logs in.
  const ensureOwnerColumn = (table: "clients" | "appointments") => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "user_id")) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN user_id TEXT NOT NULL DEFAULT '__legacy_unowned__'`);
    }
  };
  ensureOwnerColumn("clients");
  ensureOwnerColumn("appointments");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_clients_user_name ON clients(user_id, name);
    CREATE INDEX IF NOT EXISTS idx_appointments_user_start ON appointments(user_id, start_time);
    CREATE INDEX IF NOT EXISTS idx_appointments_user_google ON appointments(user_id, google_event_id);
  `);
  const configuredRetention = Number(process.env.AUDIT_RETENTION_DAYS || 365);
  const retentionDays = Number.isInteger(configuredRetention)
    ? Math.min(Math.max(configuredRetention, 30), 3650)
    : 365;
  db.prepare(`DELETE FROM audit_logs WHERE created_at < datetime('now', ?)`).run(`-${retentionDays} days`);

  // Consolidate all existing data into the shared workspace, if configured.
  migrateToWorkspace(db);
}

/**
 * When WORKSPACE_ID env var is set, all rows across the app's tables get
 * moved to that single owner id. Runs on every startup and is idempotent
 * (rows already at the workspace id are skipped).
 *
 * This is how we let multiple Google logins share the same data: everyone
 * effectively acts as the same "workspace user".
 */
function migrateToWorkspace(db: Database.Database) {
  const workspaceId = process.env.WORKSPACE_ID?.trim();
  if (!workspaceId) return;

  // Only genuinely SHARED resources go into the workspace. Appointments and
  // booking_requests stay per-user because each Google account has its own
  // Google Calendar; conversations stay per-user because chats are personal.
  const simpleTables = [
    "clients",
    "catalog_items",
    "receivables",
    "sales",
  ];

  db.transaction(() => {
    for (const table of simpleTables) {
      try {
        db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id != ?`).run(
          workspaceId,
          workspaceId
        );
      } catch (err) {
        console.warn(`Migration skip on ${table}:`, (err as Error).message);
      }
    }

    // booking_settings: PRIMARY KEY on user_id — collapse to single row.
    try {
      const alreadyExists = db
        .prepare(`SELECT user_id FROM booking_settings WHERE user_id = ?`)
        .get(workspaceId);
      if (alreadyExists) {
        db.prepare(`DELETE FROM booking_settings WHERE user_id != ?`).run(workspaceId);
      } else {
        const first = db
          .prepare(
            `SELECT slug, title, intro, timezone, work_hours, buffer_minutes,
                    max_advance_days, min_notice_hours
             FROM booking_settings WHERE user_id != ? LIMIT 1`
          )
          .get(workspaceId) as
          | {
              slug: string;
              title: string;
              intro: string | null;
              timezone: string;
              work_hours: string;
              buffer_minutes: number;
              max_advance_days: number;
              min_notice_hours: number;
            }
          | undefined;
        if (first) {
          db.prepare(`DELETE FROM booking_settings WHERE user_id != ?`).run(workspaceId);
          db.prepare(
            `INSERT INTO booking_settings
              (user_id, slug, title, intro, timezone, work_hours,
               buffer_minutes, max_advance_days, min_notice_hours)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            workspaceId,
            first.slug,
            first.title,
            first.intro,
            first.timezone,
            first.work_hours,
            first.buffer_minutes,
            first.max_advance_days,
            first.min_notice_hours
          );
        }
      }
    } catch (err) {
      console.warn("booking_settings migration:", (err as Error).message);
    }

    // booking_session_types: UNIQUE(user_id, slug) — reuse workspace rows,
    // fold in any non-workspace rows whose slug isn't already taken.
    try {
      const existingSlugs = new Set(
        (
          db
            .prepare(`SELECT slug FROM booking_session_types WHERE user_id = ?`)
            .all(workspaceId) as Array<{ slug: string }>
        ).map((r) => r.slug)
      );
      const others = db
        .prepare(`SELECT id, slug FROM booking_session_types WHERE user_id != ?`)
        .all(workspaceId) as Array<{ id: string; slug: string }>;
      for (const row of others) {
        if (existingSlugs.has(row.slug)) {
          db.prepare(`DELETE FROM booking_session_types WHERE id = ?`).run(row.id);
        } else {
          db.prepare(
            `UPDATE booking_session_types SET user_id = ? WHERE id = ?`
          ).run(workspaceId, row.id);
          existingSlugs.add(row.slug);
        }
      }
    } catch (err) {
      console.warn("booking_session_types migration:", (err as Error).message);
    }
  })();
}

// --- Clients ---

export interface ClientRow {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function listClients(userId: string, search?: string): ClientRow[] {
  const d = getDb();
  if (search) {
    return d.prepare(
      `SELECT * FROM clients WHERE user_id = ? AND (name LIKE ? OR phone LIKE ? OR email LIKE ?) ORDER BY name`
    ).all(userId, `%${search}%`, `%${search}%`, `%${search}%`) as ClientRow[];
  }
  return d.prepare(`SELECT * FROM clients WHERE user_id = ? ORDER BY name`).all(userId) as ClientRow[];
}

export function getClient(userId: string, id: string): ClientRow | undefined {
  return getDb().prepare(`SELECT * FROM clients WHERE user_id = ? AND id = ?`).get(userId, id) as ClientRow | undefined;
}

export function getClientByName(userId: string, name: string): ClientRow | undefined {
  return getDb().prepare(`SELECT * FROM clients WHERE user_id = ? AND LOWER(name) = LOWER(?)`).get(userId, name) as ClientRow | undefined;
}

export function createClient(userId: string, data: { name: string; phone?: string; email?: string; notes?: string }): ClientRow {
  const id = uuidv4();
  getDb().prepare(
    `INSERT INTO clients (id, user_id, name, phone, email, notes) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, userId, data.name, data.phone || null, data.email || null, data.notes || null);
  return getClient(userId, id)!;
}

export function updateClient(userId: string, id: string, data: Partial<{ name: string; phone: string; email: string; notes: string }>): ClientRow | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (fields.length === 0) return getClient(userId, id);
  fields.push(`updated_at = datetime('now')`);
  values.push(userId, id);
  getDb().prepare(`UPDATE clients SET ${fields.join(", ")} WHERE user_id = ? AND id = ?`).run(...values);
  return getClient(userId, id);
}

export function deleteClient(userId: string, id: string): boolean {
  const result = getDb().prepare(`DELETE FROM clients WHERE user_id = ? AND id = ?`).run(userId, id);
  return result.changes > 0;
}

// --- Appointments ---

export interface AppointmentRow {
  id: string;
  user_id: string;
  title: string;
  type: string;
  client_id: string | null;
  client_name: string | null;
  start_time: string;
  end_time: string;
  notes: string | null;
  google_event_id: string | null;
  status: string;
  reminders: string;
  created_at: string;
  updated_at: string;
}

export function listAppointments(userId: string, filters?: { startDate?: string; endDate?: string; clientId?: string; status?: string }): AppointmentRow[] {
  const conditions: string[] = [`user_id = ?`];
  const params: unknown[] = [userId];

  if (filters?.startDate) {
    conditions.push(`start_time >= ?`);
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    conditions.push(`start_time <= ?`);
    params.push(filters.endDate);
  }
  if (filters?.clientId) {
    conditions.push(`client_id = ?`);
    params.push(filters.clientId);
  }
  if (filters?.status) {
    conditions.push(`status = ?`);
    params.push(filters.status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return getDb().prepare(`SELECT * FROM appointments ${where} ORDER BY start_time`).all(...params) as AppointmentRow[];
}

export function getAppointment(userId: string, id: string): AppointmentRow | undefined {
  return getDb().prepare(`SELECT * FROM appointments WHERE user_id = ? AND id = ?`).get(userId, id) as AppointmentRow | undefined;
}

export function getAppointmentByGoogleId(userId: string, googleEventId: string): AppointmentRow | undefined {
  return getDb().prepare(`SELECT * FROM appointments WHERE user_id = ? AND google_event_id = ?`).get(userId, googleEventId) as AppointmentRow | undefined;
}

export function createAppointment(userId: string, data: {
  title: string;
  type?: string;
  clientId?: string;
  clientName?: string;
  startTime: string;
  endTime: string;
  notes?: string;
  googleEventId?: string;
  status?: string;
}): AppointmentRow {
  const id = uuidv4();
  getDb().prepare(
    `INSERT INTO appointments (id, user_id, title, type, client_id, client_name, start_time, end_time, notes, google_event_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    data.title,
    data.type || "outro",
    data.clientId || null,
    data.clientName || null,
    data.startTime,
    data.endTime,
    data.notes || null,
    data.googleEventId || null,
    data.status || "previsto"
  );
  return getAppointment(userId, id)!;
}

export function updateAppointment(userId: string, id: string, data: Partial<{
  title: string;
  type: string;
  clientId: string;
  clientName: string;
  startTime: string;
  endTime: string;
  notes: string;
  googleEventId: string;
  status: string;
}>): AppointmentRow | undefined {
  const fieldMap: Record<string, string> = {
    clientId: "client_id",
    clientName: "client_name",
    startTime: "start_time",
    endTime: "end_time",
    googleEventId: "google_event_id",
  };

  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      const col = fieldMap[key] || key;
      fields.push(`${col} = ?`);
      values.push(val);
    }
  }
  if (fields.length === 0) return getAppointment(userId, id);
  fields.push(`updated_at = datetime('now')`);
  values.push(userId, id);
  getDb().prepare(`UPDATE appointments SET ${fields.join(", ")} WHERE user_id = ? AND id = ?`).run(...values);
  return getAppointment(userId, id);
}

export function deleteAppointment(userId: string, id: string): boolean {
  const result = getDb().prepare(`DELETE FROM appointments WHERE user_id = ? AND id = ?`).run(userId, id);
  return result.changes > 0;
}

export function getClientAppointments(userId: string, clientId: string): AppointmentRow[] {
  return getDb().prepare(
    `SELECT * FROM appointments WHERE user_id = ? AND client_id = ? ORDER BY start_time DESC`
  ).all(userId, clientId) as AppointmentRow[];
}

// --- Conversations ---

export interface ConversationRow {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: number;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
}

export function listConversations(userId: string, limit = 50): ConversationRow[] {
  return getDb().prepare(
    `SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?`
  ).all(userId, limit) as ConversationRow[];
}

export function getConversation(userId: string, id: string): ConversationRow | undefined {
  return getDb().prepare(`SELECT * FROM conversations WHERE user_id = ? AND id = ?`).get(userId, id) as ConversationRow | undefined;
}

export function createConversation(data: {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  title?: string;
}): ConversationRow {
  getDb().prepare(
    `INSERT INTO conversations (id, user_id, user_name, user_email, title) VALUES (?, ?, ?, ?, ?)`
  ).run(data.id, data.userId, data.userName || null, data.userEmail || null, data.title || null);
  return getConversation(data.userId, data.id)!;
}

export function updateConversationTitle(userId: string, id: string, title: string): void {
  getDb().prepare(
    `UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE user_id = ? AND id = ?`
  ).run(title, userId, id);
}

export function touchConversation(userId: string, id: string): void {
  getDb().prepare(
    `UPDATE conversations SET updated_at = datetime('now') WHERE user_id = ? AND id = ?`
  ).run(userId, id);
}

export function deleteConversation(userId: string, id: string): boolean {
  const result = getDb().prepare(`DELETE FROM conversations WHERE user_id = ? AND id = ?`).run(userId, id);
  return result.changes > 0;
}

export function getMessages(userId: string, conversationId: string): MessageRow[] {
  return getDb().prepare(
    `SELECT messages.* FROM messages
     INNER JOIN conversations ON conversations.id = messages.conversation_id
     WHERE conversations.user_id = ? AND messages.conversation_id = ?
     ORDER BY messages.created_at ASC`
  ).all(userId, conversationId) as MessageRow[];
}

export function addMessage(userId: string, conversationId: string, role: string, content: string): MessageRow {
  const result = getDb().prepare(
    `INSERT INTO messages (conversation_id, role, content)
     SELECT id, ?, ? FROM conversations WHERE user_id = ? AND id = ?`
  ).run(role, content, userId, conversationId);
  if (result.changes !== 1) throw new Error("Conversa não encontrada");
  touchConversation(userId, conversationId);
  return getDb().prepare(`SELECT * FROM messages WHERE id = ?`).get(result.lastInsertRowid) as MessageRow;
}

export function generateTitle(firstMessage: string): string {
  const clean = firstMessage.replace(/\n/g, " ").trim();
  if (clean.length <= 60) return clean;
  return clean.substring(0, 57) + "...";
}

// --- Audit and privacy ---

export function writeAuditLog(userId: string | null, action: string, resource: string, statusCode: number): void {
  getDb().prepare(
    `INSERT INTO audit_logs (user_id, action, resource, status_code) VALUES (?, ?, ?, ?)`
  ).run(userId, action, resource, statusCode);
}

export function recordPrivacyConsent(userId: string, version: string): void {
  getDb().prepare(`
    INSERT INTO privacy_consents (user_id, version, accepted_at, revoked_at)
    VALUES (?, ?, datetime('now'), NULL)
    ON CONFLICT(user_id, version) DO UPDATE SET accepted_at = datetime('now'), revoked_at = NULL
  `).run(userId, version);
}

export function getPrivacyConsent(userId: string, version: string): { accepted_at: string; revoked_at: string | null } | undefined {
  return getDb().prepare(
    `SELECT accepted_at, revoked_at FROM privacy_consents WHERE user_id = ? AND version = ?`
  ).get(userId, version) as { accepted_at: string; revoked_at: string | null } | undefined;
}

export function exportUserData(userId: string) {
  const database = getDb();
  const clients = database.prepare(`SELECT * FROM clients WHERE user_id = ?`).all(userId);
  const appointments = database.prepare(`SELECT * FROM appointments WHERE user_id = ?`).all(userId);
  const conversations = database.prepare(`SELECT * FROM conversations WHERE user_id = ?`).all(userId) as ConversationRow[];
  const messages = database.prepare(`
    SELECT messages.* FROM messages
    INNER JOIN conversations ON conversations.id = messages.conversation_id
    WHERE conversations.user_id = ? ORDER BY messages.created_at
  `).all(userId);
  const consents = database.prepare(`SELECT version, accepted_at, revoked_at FROM privacy_consents WHERE user_id = ?`).all(userId);
  const bookingSettings = database.prepare(`SELECT * FROM booking_settings WHERE user_id = ?`).get(userId) || null;
  const bookingSessionTypes = database.prepare(`SELECT * FROM booking_session_types WHERE user_id = ?`).all(userId);
  const bookingRequests = database.prepare(`SELECT * FROM booking_requests WHERE user_id = ?`).all(userId);
  const audit = database.prepare(`
    SELECT action, resource, status_code, created_at FROM audit_logs
    WHERE user_id = ? ORDER BY created_at DESC LIMIT 1000
  `).all(userId);
  return { clients, appointments, conversations, messages, bookingSettings, bookingSessionTypes, bookingRequests, consents, audit };
}

export function deleteUserData(userId: string): void {
  const database = getDb();
  database.transaction(() => {
    database.prepare(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)`).run(userId);
    database.prepare(`DELETE FROM conversations WHERE user_id = ?`).run(userId);
    database.prepare(`DELETE FROM appointments WHERE user_id = ?`).run(userId);
    database.prepare(`DELETE FROM clients WHERE user_id = ?`).run(userId);
    database.prepare(`DELETE FROM booking_requests WHERE user_id = ?`).run(userId);
    database.prepare(`DELETE FROM booking_session_types WHERE user_id = ?`).run(userId);
    database.prepare(`DELETE FROM booking_settings WHERE user_id = ?`).run(userId);
    database.prepare(`DELETE FROM privacy_consents WHERE user_id = ?`).run(userId);
    database.prepare(`DELETE FROM audit_logs WHERE user_id = ?`).run(userId);
  })();
}
