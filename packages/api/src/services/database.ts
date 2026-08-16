import Database from "better-sqlite3";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../../data/assistente-fabi.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
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
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
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
  `);
}

// --- Clients ---

export interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function listClients(search?: string): ClientRow[] {
  const d = getDb();
  if (search) {
    return d.prepare(
      `SELECT * FROM clients WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? ORDER BY name`
    ).all(`%${search}%`, `%${search}%`, `%${search}%`) as ClientRow[];
  }
  return d.prepare(`SELECT * FROM clients ORDER BY name`).all() as ClientRow[];
}

export function getClient(id: string): ClientRow | undefined {
  return getDb().prepare(`SELECT * FROM clients WHERE id = ?`).get(id) as ClientRow | undefined;
}

export function getClientByName(name: string): ClientRow | undefined {
  return getDb().prepare(`SELECT * FROM clients WHERE LOWER(name) = LOWER(?)`).get(name) as ClientRow | undefined;
}

export function createClient(data: { name: string; phone?: string; email?: string; notes?: string }): ClientRow {
  const id = uuidv4();
  getDb().prepare(
    `INSERT INTO clients (id, name, phone, email, notes) VALUES (?, ?, ?, ?, ?)`
  ).run(id, data.name, data.phone || null, data.email || null, data.notes || null);
  return getClient(id)!;
}

export function updateClient(id: string, data: Partial<{ name: string; phone: string; email: string; notes: string }>): ClientRow | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (fields.length === 0) return getClient(id);
  fields.push(`updated_at = datetime('now')`);
  values.push(id);
  getDb().prepare(`UPDATE clients SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getClient(id);
}

export function deleteClient(id: string): boolean {
  const result = getDb().prepare(`DELETE FROM clients WHERE id = ?`).run(id);
  return result.changes > 0;
}

// --- Appointments ---

export interface AppointmentRow {
  id: string;
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

export function listAppointments(filters?: { startDate?: string; endDate?: string; clientId?: string; status?: string }): AppointmentRow[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

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

export function getAppointment(id: string): AppointmentRow | undefined {
  return getDb().prepare(`SELECT * FROM appointments WHERE id = ?`).get(id) as AppointmentRow | undefined;
}

export function getAppointmentByGoogleId(googleEventId: string): AppointmentRow | undefined {
  return getDb().prepare(`SELECT * FROM appointments WHERE google_event_id = ?`).get(googleEventId) as AppointmentRow | undefined;
}

export function createAppointment(data: {
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
    `INSERT INTO appointments (id, title, type, client_id, client_name, start_time, end_time, notes, google_event_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
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
  return getAppointment(id)!;
}

export function updateAppointment(id: string, data: Partial<{
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
  if (fields.length === 0) return getAppointment(id);
  fields.push(`updated_at = datetime('now')`);
  values.push(id);
  getDb().prepare(`UPDATE appointments SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getAppointment(id);
}

export function deleteAppointment(id: string): boolean {
  const result = getDb().prepare(`DELETE FROM appointments WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function getClientAppointments(clientId: string): AppointmentRow[] {
  return getDb().prepare(
    `SELECT * FROM appointments WHERE client_id = ? ORDER BY start_time DESC`
  ).all(clientId) as AppointmentRow[];
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

export function getConversation(id: string): ConversationRow | undefined {
  return getDb().prepare(`SELECT * FROM conversations WHERE id = ?`).get(id) as ConversationRow | undefined;
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
  return getConversation(data.id)!;
}

export function updateConversationTitle(id: string, title: string): void {
  getDb().prepare(
    `UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(title, id);
}

export function touchConversation(id: string): void {
  getDb().prepare(
    `UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`
  ).run(id);
}

export function deleteConversation(id: string): boolean {
  const result = getDb().prepare(`DELETE FROM conversations WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function getMessages(conversationId: string): MessageRow[] {
  return getDb().prepare(
    `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`
  ).all(conversationId) as MessageRow[];
}

export function addMessage(conversationId: string, role: string, content: string): MessageRow {
  const result = getDb().prepare(
    `INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)`
  ).run(conversationId, role, content);
  touchConversation(conversationId);
  return getDb().prepare(`SELECT * FROM messages WHERE id = ?`).get(result.lastInsertRowid) as MessageRow;
}

export function generateTitle(firstMessage: string): string {
  const clean = firstMessage.replace(/\n/g, " ").trim();
  if (clean.length <= 60) return clean;
  return clean.substring(0, 57) + "...";
}
