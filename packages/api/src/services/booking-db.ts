import { randomBytes } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "./database";

export type WorkHours = Record<string, [string, string][]>;

export interface BookingSettings {
  user_id: string;
  slug: string;
  title: string;
  intro: string | null;
  timezone: string;
  work_hours: WorkHours;
  buffer_minutes: number;
  max_advance_days: number;
  min_notice_hours: number;
  updated_at: string;
}

interface BookingSettingsRow extends Omit<BookingSettings, "work_hours"> {
  work_hours: string;
}

export interface BookingSessionType {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  color: string | null;
  active: number;
  sort_order: number;
}

export type BookingRequestStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "canceled";

export interface BookingRequest {
  id: string;
  user_id: string;
  session_type_id: string | null;
  session_type_name: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  client_notes: string | null;
  requested_start: string;
  requested_end: string;
  status: BookingRequestStatus;
  google_event_id: string | null;
  manage_token: string;
  responded_at: string | null;
  responded_reason: string | null;
  created_at: string;
}

function parseSettings(row: BookingSettingsRow | undefined): BookingSettings | null {
  if (!row) return null;
  return {
    ...row,
    intro: row.intro ?? null,
    work_hours: safeParseWorkHours(row.work_hours),
  };
}

function safeParseWorkHours(raw: string): WorkHours {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as WorkHours;
  } catch {
    // ignore
  }
  return {};
}

function randomSlug(): string {
  return `fabi-${randomBytes(3).toString("hex")}`;
}

export function getSettingsForUser(userId: string): BookingSettings | null {
  const row = getDb()
    .prepare(`SELECT * FROM booking_settings WHERE user_id = ?`)
    .get(userId) as BookingSettingsRow | undefined;
  return parseSettings(row);
}

export function getSettingsBySlug(slug: string): BookingSettings | null {
  const row = getDb()
    .prepare(`SELECT * FROM booking_settings WHERE slug = ?`)
    .get(slug) as BookingSettingsRow | undefined;
  return parseSettings(row);
}

export function ensureSettings(userId: string): BookingSettings {
  const existing = getSettingsForUser(userId);
  if (existing) return existing;
  const slug = randomSlug();
  getDb()
    .prepare(
      `INSERT INTO booking_settings (user_id, slug) VALUES (?, ?)
       ON CONFLICT(user_id) DO NOTHING`
    )
    .run(userId, slug);
  return getSettingsForUser(userId)!;
}

export function updateSettings(
  userId: string,
  patch: Partial<Omit<BookingSettings, "user_id" | "updated_at">>
): BookingSettings {
  ensureSettings(userId);
  const fields: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, unknown> = {
    slug: patch.slug,
    title: patch.title,
    intro: patch.intro,
    timezone: patch.timezone,
    work_hours: patch.work_hours ? JSON.stringify(patch.work_hours) : undefined,
    buffer_minutes: patch.buffer_minutes,
    max_advance_days: patch.max_advance_days,
    min_notice_hours: patch.min_notice_hours,
  };
  for (const [key, val] of Object.entries(map)) {
    if (val === undefined) continue;
    fields.push(`${key} = ?`);
    values.push(val);
  }
  if (fields.length === 0) return getSettingsForUser(userId)!;
  fields.push(`updated_at = datetime('now')`);
  values.push(userId);
  getDb()
    .prepare(`UPDATE booking_settings SET ${fields.join(", ")} WHERE user_id = ?`)
    .run(...values);
  return getSettingsForUser(userId)!;
}

export function listSessionTypes(userId: string, onlyActive = false): BookingSessionType[] {
  const where = onlyActive ? "WHERE user_id = ? AND active = 1" : "WHERE user_id = ?";
  return getDb()
    .prepare(
      `SELECT * FROM booking_session_types ${where} ORDER BY sort_order ASC, name ASC`
    )
    .all(userId) as BookingSessionType[];
}

export function getSessionTypeById(
  userId: string,
  id: string
): BookingSessionType | null {
  return (
    (getDb()
      .prepare(`SELECT * FROM booking_session_types WHERE user_id = ? AND id = ?`)
      .get(userId, id) as BookingSessionType | undefined) ?? null
  );
}

export function getSessionTypeBySlug(
  userId: string,
  slug: string
): BookingSessionType | null {
  return (
    (getDb()
      .prepare(`SELECT * FROM booking_session_types WHERE user_id = ? AND slug = ?`)
      .get(userId, slug) as BookingSessionType | undefined) ?? null
  );
}

export function createSessionType(
  userId: string,
  data: Omit<BookingSessionType, "id" | "user_id" | "active" | "sort_order"> & {
    active?: number;
    sort_order?: number;
  }
): BookingSessionType {
  const id = uuidv4();
  getDb()
    .prepare(
      `INSERT INTO booking_session_types
       (id, user_id, slug, name, description, duration_minutes, color, active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      userId,
      data.slug,
      data.name,
      data.description ?? null,
      data.duration_minutes,
      data.color ?? null,
      data.active ?? 1,
      data.sort_order ?? 0
    );
  return getSessionTypeById(userId, id)!;
}

export function updateSessionType(
  userId: string,
  id: string,
  patch: Partial<Omit<BookingSessionType, "id" | "user_id">>
): BookingSessionType | null {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(patch)) {
    if (val === undefined) continue;
    fields.push(`${key} = ?`);
    values.push(val);
  }
  if (fields.length === 0) return getSessionTypeById(userId, id);
  values.push(userId, id);
  getDb()
    .prepare(
      `UPDATE booking_session_types SET ${fields.join(", ")} WHERE user_id = ? AND id = ?`
    )
    .run(...values);
  return getSessionTypeById(userId, id);
}

export function deleteSessionType(userId: string, id: string): boolean {
  const result = getDb()
    .prepare(`DELETE FROM booking_session_types WHERE user_id = ? AND id = ?`)
    .run(userId, id);
  return result.changes > 0;
}

/**
 * Slug helper mirroring the one used by the catalog. Public booking URLs
 * reference session types by slug, so we compute them from the item name.
 */
export function slugifyCatalog(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Return active services from the catalog formatted as BookingSessionType.
 * The catalog is the single source of truth for what shows up on the public
 * booking page and in the admin's "Types" list.
 */
export function listCatalogSessionTypes(userId: string): BookingSessionType[] {
  const rows = getDb()
    .prepare(
      `SELECT id, name, description, price_cents, duration_minutes, active, sort_order
       FROM catalog_items
       WHERE user_id = ? AND kind = 'servico' AND active = 1
       ORDER BY sort_order ASC, name ASC`
    )
    .all(userId) as Array<{
    id: string;
    name: string;
    description: string | null;
    price_cents: number;
    duration_minutes: number | null;
    active: number;
    sort_order: number;
  }>;
  return rows
    .filter((r) => (r.duration_minutes ?? 0) > 0)
    .map((r) => ({
      id: r.id,
      user_id: userId,
      slug: slugifyCatalog(r.name),
      name: r.name,
      description: r.description,
      duration_minutes: r.duration_minutes || 60,
      color: null,
      active: r.active,
      sort_order: r.sort_order,
    }));
}

export function findCatalogSessionTypeBySlug(
  userId: string,
  slug: string
): BookingSessionType | null {
  const items = listCatalogSessionTypes(userId);
  return items.find((i) => i.slug === slug) ?? null;
}

export function findCatalogSessionTypeById(
  userId: string,
  id: string
): BookingSessionType | null {
  const items = listCatalogSessionTypes(userId);
  return items.find((i) => i.id === id) ?? null;
}

export interface CreateBookingRequestInput {
  userId: string;
  sessionTypeId: string | null;
  sessionTypeName: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  clientNotes?: string | null;
  requestedStart: string;
  requestedEnd: string;
}

export function createBookingRequest(input: CreateBookingRequestInput): BookingRequest {
  const id = uuidv4();
  const manageToken = randomBytes(24).toString("base64url");
  getDb()
    .prepare(
      `INSERT INTO booking_requests
       (id, user_id, session_type_id, session_type_name, client_name, client_email,
        client_phone, client_notes, requested_start, requested_end, manage_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.userId,
      input.sessionTypeId,
      input.sessionTypeName,
      input.clientName,
      input.clientEmail,
      input.clientPhone ?? null,
      input.clientNotes ?? null,
      input.requestedStart,
      input.requestedEnd,
      manageToken
    );
  return getBookingRequestById(id)!;
}

export function listBookingRequests(
  userId: string,
  status?: BookingRequestStatus
): BookingRequest[] {
  if (status) {
    return getDb()
      .prepare(
        `SELECT * FROM booking_requests WHERE user_id = ? AND status = ?
         ORDER BY requested_start ASC`
      )
      .all(userId, status) as BookingRequest[];
  }
  return getDb()
    .prepare(
      `SELECT * FROM booking_requests WHERE user_id = ?
       ORDER BY status ASC, requested_start ASC`
    )
    .all(userId) as BookingRequest[];
}

export function getBookingRequestById(id: string): BookingRequest | null {
  return (
    (getDb()
      .prepare(`SELECT * FROM booking_requests WHERE id = ?`)
      .get(id) as BookingRequest | undefined) ?? null
  );
}

export function getBookingRequestByToken(token: string): BookingRequest | null {
  return (
    (getDb()
      .prepare(`SELECT * FROM booking_requests WHERE manage_token = ?`)
      .get(token) as BookingRequest | undefined) ?? null
  );
}

export function markBookingRequest(
  id: string,
  status: BookingRequestStatus,
  extras: { googleEventId?: string | null; reason?: string | null } = {}
): void {
  getDb()
    .prepare(
      `UPDATE booking_requests
       SET status = ?, google_event_id = COALESCE(?, google_event_id),
           responded_reason = ?, responded_at = datetime('now')
       WHERE id = ?`
    )
    .run(status, extras.googleEventId ?? null, extras.reason ?? null, id);
}

export function countPendingRequests(userId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as c FROM booking_requests WHERE user_id = ? AND status = 'pending'`
    )
    .get(userId) as { c: number };
  return row?.c ?? 0;
}

export function listConflictingRequests(
  userId: string,
  startISO: string,
  endISO: string
): BookingRequest[] {
  return getDb()
    .prepare(
      `SELECT * FROM booking_requests
       WHERE user_id = ? AND status IN ('pending','confirmed')
         AND NOT (requested_end <= ? OR requested_start >= ?)`
    )
    .all(userId, startISO, endISO) as BookingRequest[];
}
