import { v4 as uuidv4 } from "uuid";
import { getDb } from "./database";

export type ReceivableStatus = "pendente" | "pago" | "cancelado";

export type PaymentMethod =
  | "pix"
  | "dinheiro"
  | "cartao_credito"
  | "cartao_debito"
  | "transferencia"
  | "boleto"
  | "outro";

export interface Receivable {
  id: string;
  user_id: string;
  appointment_id: string | null;
  catalog_item_id: string | null;
  client_id: string | null;
  client_name: string;
  item_name: string;
  amount_cents: number;
  service_date: string;
  due_date: string;
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  status: ReceivableStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReceivableSummary {
  a_receber_cents: number;
  recebido_mes_cents: number;
  em_atraso_cents: number;
  a_receber_count: number;
  em_atraso_count: number;
}

export function listReceivables(
  userId: string,
  filter?: { status?: ReceivableStatus }
): Receivable[] {
  const params: unknown[] = [userId];
  let sql = `SELECT * FROM receivables WHERE user_id = ?`;
  if (filter?.status) {
    sql += ` AND status = ?`;
    params.push(filter.status);
  }
  sql += ` ORDER BY due_date DESC, created_at DESC`;
  return getDb().prepare(sql).all(...params) as Receivable[];
}

export function getReceivable(userId: string, id: string): Receivable | undefined {
  return getDb()
    .prepare(`SELECT * FROM receivables WHERE user_id = ? AND id = ?`)
    .get(userId, id) as Receivable | undefined;
}

export function getReceivableByAppointmentId(
  userId: string,
  appointmentId: string
): Receivable | undefined {
  return getDb()
    .prepare(
      `SELECT * FROM receivables WHERE user_id = ? AND appointment_id = ?`
    )
    .get(userId, appointmentId) as Receivable | undefined;
}

export function createReceivable(
  userId: string,
  data: {
    appointment_id?: string | null;
    catalog_item_id?: string | null;
    client_id?: string | null;
    client_name: string;
    item_name: string;
    amount_cents: number;
    service_date: string;
    due_date?: string;
    payment_method?: PaymentMethod | null;
    status?: ReceivableStatus;
    paid_at?: string | null;
    notes?: string | null;
  }
): Receivable {
  const id = uuidv4();
  const due = data.due_date || data.service_date;
  getDb()
    .prepare(
      `INSERT INTO receivables
        (id, user_id, appointment_id, catalog_item_id, client_id, client_name,
         item_name, amount_cents, service_date, due_date, paid_at, payment_method, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      userId,
      data.appointment_id ?? null,
      data.catalog_item_id ?? null,
      data.client_id ?? null,
      data.client_name,
      data.item_name,
      data.amount_cents,
      data.service_date,
      due,
      data.paid_at ?? null,
      data.payment_method ?? null,
      data.status ?? "pendente",
      data.notes ?? null
    );
  return getReceivable(userId, id)!;
}

export function updateReceivable(
  userId: string,
  id: string,
  patch: Partial<{
    catalog_item_id: string | null;
    client_id: string | null;
    client_name: string;
    item_name: string;
    amount_cents: number;
    service_date: string;
    due_date: string;
    paid_at: string | null;
    payment_method: PaymentMethod | null;
    status: ReceivableStatus;
    notes: string | null;
  }>
): Receivable | undefined {
  const existing = getReceivable(userId, id);
  if (!existing) return undefined;
  const merged = { ...existing, ...patch };
  getDb()
    .prepare(
      `UPDATE receivables SET
         catalog_item_id = ?, client_id = ?, client_name = ?, item_name = ?,
         amount_cents = ?, service_date = ?, due_date = ?, paid_at = ?,
         payment_method = ?, status = ?, notes = ?, updated_at = datetime('now')
       WHERE user_id = ? AND id = ?`
    )
    .run(
      merged.catalog_item_id,
      merged.client_id,
      merged.client_name,
      merged.item_name,
      merged.amount_cents,
      merged.service_date,
      merged.due_date,
      merged.paid_at,
      merged.payment_method,
      merged.status,
      merged.notes,
      userId,
      id
    );
  return getReceivable(userId, id);
}

export function deleteReceivable(userId: string, id: string): boolean {
  const info = getDb()
    .prepare(`DELETE FROM receivables WHERE user_id = ? AND id = ?`)
    .run(userId, id);
  return info.changes > 0;
}

export function getReceivablesSummary(userId: string): ReceivableSummary {
  const now = new Date().toISOString();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startIso = startOfMonth.toISOString();

  const pending = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total, COUNT(*) AS n
       FROM receivables WHERE user_id = ? AND status = 'pendente'`
    )
    .get(userId) as { total: number; n: number };

  const overdue = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total, COUNT(*) AS n
       FROM receivables WHERE user_id = ? AND status = 'pendente' AND due_date < ?`
    )
    .get(userId, now.slice(0, 10)) as { total: number; n: number };

  const paidMonth = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM receivables WHERE user_id = ? AND status = 'pago' AND paid_at IS NOT NULL AND paid_at >= ?`
    )
    .get(userId, startIso) as { total: number };

  return {
    a_receber_cents: pending.total,
    recebido_mes_cents: paidMonth.total,
    em_atraso_cents: overdue.total,
    a_receber_count: pending.n,
    em_atraso_count: overdue.n,
  };
}

/**
 * Try to auto-generate a receivable from an appointment when it's marked concluído.
 * Returns the created receivable, or null if one already exists (idempotent).
 */
export function createReceivableFromAppointment(
  userId: string,
  appointment: {
    id: string;
    title: string;
    client_id: string | null;
    client_name: string | null;
    start_time: string;
  },
  matchedCatalogItem?: {
    id: string;
    name: string;
    price_cents: number;
  } | null
): Receivable | null {
  const existing = getReceivableByAppointmentId(userId, appointment.id);
  if (existing) return null;
  const itemName = matchedCatalogItem?.name || appointment.title;
  const amount = matchedCatalogItem?.price_cents ?? 0;
  return createReceivable(userId, {
    appointment_id: appointment.id,
    catalog_item_id: matchedCatalogItem?.id ?? null,
    client_id: appointment.client_id,
    client_name: appointment.client_name || "—",
    item_name: itemName,
    amount_cents: amount,
    service_date: appointment.start_time,
    due_date: appointment.start_time,
  });
}
