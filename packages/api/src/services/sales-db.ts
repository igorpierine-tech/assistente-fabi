import { v4 as uuidv4 } from "uuid";
import { getDb } from "./database";
import type { PaymentMethod } from "./receivables-db";

export interface Sale {
  id: string;
  user_id: string;
  client_id: string | null;
  client_name: string;
  client_document: string | null;
  client_email: string | null;
  client_phone: string | null;
  catalog_item_id: string | null;
  item_name: string;
  amount_cents: number;
  payment_method: PaymentMethod | null;
  installments: number;
  sale_date: string;
  notes: string | null;
  contract_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export function listSales(userId: string): Sale[] {
  return getDb()
    .prepare(
      `SELECT * FROM sales WHERE user_id = ? ORDER BY sale_date DESC, created_at DESC`
    )
    .all(userId) as Sale[];
}

export function getSale(userId: string, id: string): Sale | undefined {
  return getDb()
    .prepare(`SELECT * FROM sales WHERE user_id = ? AND id = ?`)
    .get(userId, id) as Sale | undefined;
}

export function createSale(
  userId: string,
  data: {
    client_id?: string | null;
    client_name: string;
    client_document?: string | null;
    client_email?: string | null;
    client_phone?: string | null;
    catalog_item_id?: string | null;
    item_name: string;
    amount_cents: number;
    payment_method?: PaymentMethod | null;
    installments?: number;
    sale_date?: string;
    notes?: string | null;
  }
): Sale {
  const id = uuidv4();
  const sale_date = data.sale_date || new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO sales
        (id, user_id, client_id, client_name, client_document, client_email, client_phone,
         catalog_item_id, item_name, amount_cents, payment_method, installments, sale_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      userId,
      data.client_id ?? null,
      data.client_name,
      data.client_document ?? null,
      data.client_email ?? null,
      data.client_phone ?? null,
      data.catalog_item_id ?? null,
      data.item_name,
      data.amount_cents,
      data.payment_method ?? null,
      Math.max(1, data.installments ?? 1),
      sale_date,
      data.notes ?? null
    );
  return getSale(userId, id)!;
}

export function updateSale(
  userId: string,
  id: string,
  patch: Partial<Omit<Sale, "id" | "user_id" | "created_at" | "updated_at">>
): Sale | undefined {
  const existing = getSale(userId, id);
  if (!existing) return undefined;
  const merged = { ...existing, ...patch };
  getDb()
    .prepare(
      `UPDATE sales SET
         client_id = ?, client_name = ?, client_document = ?, client_email = ?, client_phone = ?,
         catalog_item_id = ?, item_name = ?, amount_cents = ?, payment_method = ?,
         installments = ?, sale_date = ?, notes = ?, contract_generated_at = ?,
         updated_at = datetime('now')
       WHERE user_id = ? AND id = ?`
    )
    .run(
      merged.client_id,
      merged.client_name,
      merged.client_document,
      merged.client_email,
      merged.client_phone,
      merged.catalog_item_id,
      merged.item_name,
      merged.amount_cents,
      merged.payment_method,
      merged.installments,
      merged.sale_date,
      merged.notes,
      merged.contract_generated_at,
      userId,
      id
    );
  return getSale(userId, id);
}

export function markContractGenerated(userId: string, id: string): void {
  getDb()
    .prepare(
      `UPDATE sales SET contract_generated_at = datetime('now'), updated_at = datetime('now')
       WHERE user_id = ? AND id = ?`
    )
    .run(userId, id);
}

export function deleteSale(userId: string, id: string): boolean {
  const info = getDb()
    .prepare(`DELETE FROM sales WHERE user_id = ? AND id = ?`)
    .run(userId, id);
  return info.changes > 0;
}
