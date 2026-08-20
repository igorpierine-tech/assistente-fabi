import { v4 as uuidv4 } from "uuid";
import { getDb } from "./database";

export type CatalogKind = "produto" | "servico";

export interface CatalogItem {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  kind: CatalogKind;
  price_cents: number;
  duration_minutes: number | null;
  active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function listCatalogItems(userId: string): CatalogItem[] {
  return getDb()
    .prepare(
      `SELECT * FROM catalog_items WHERE user_id = ? ORDER BY sort_order ASC, name ASC`
    )
    .all(userId) as CatalogItem[];
}

export function getCatalogItem(userId: string, id: string): CatalogItem | undefined {
  return getDb()
    .prepare(`SELECT * FROM catalog_items WHERE user_id = ? AND id = ?`)
    .get(userId, id) as CatalogItem | undefined;
}

export function createCatalogItem(
  userId: string,
  data: {
    name: string;
    description?: string | null;
    kind: CatalogKind;
    price_cents: number;
    duration_minutes?: number | null;
    active?: number;
    sort_order?: number;
  }
): CatalogItem {
  const id = uuidv4();
  getDb()
    .prepare(
      `INSERT INTO catalog_items (id, user_id, name, description, kind, price_cents, duration_minutes, active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      userId,
      data.name,
      data.description ?? null,
      data.kind,
      data.price_cents,
      data.duration_minutes ?? null,
      data.active ?? 1,
      data.sort_order ?? 0
    );
  return getCatalogItem(userId, id)!;
}

export function updateCatalogItem(
  userId: string,
  id: string,
  patch: Partial<{
    name: string;
    description: string | null;
    kind: CatalogKind;
    price_cents: number;
    duration_minutes: number | null;
    active: number;
    sort_order: number;
  }>
): CatalogItem | undefined {
  const existing = getCatalogItem(userId, id);
  if (!existing) return undefined;
  const merged = { ...existing, ...patch };
  getDb()
    .prepare(
      `UPDATE catalog_items
       SET name = ?, description = ?, kind = ?, price_cents = ?, duration_minutes = ?, active = ?, sort_order = ?, updated_at = datetime('now')
       WHERE user_id = ? AND id = ?`
    )
    .run(
      merged.name,
      merged.description,
      merged.kind,
      merged.price_cents,
      merged.duration_minutes,
      merged.active,
      merged.sort_order,
      userId,
      id
    );
  return getCatalogItem(userId, id);
}

export function deleteCatalogItem(userId: string, id: string): boolean {
  const info = getDb()
    .prepare(`DELETE FROM catalog_items WHERE user_id = ? AND id = ?`)
    .run(userId, id);
  return info.changes > 0;
}
