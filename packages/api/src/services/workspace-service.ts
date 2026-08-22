/**
 * Concrete WorkspaceService implementation used by the AI agent to perform
 * every non-calendar action (clients, catalog, receivables, sales). All ops
 * are scoped to a single workspace/user id.
 */

import type { WorkspaceService, PaymentMethod } from "@assistente-fabi/ai";
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
  getClient,
} from "./database";
import {
  listCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  type CatalogKind,
} from "./catalog-db";
import {
  listReceivables,
  createReceivable,
  updateReceivable,
  deleteReceivable,
  getReceivablesSummary,
  type ReceivableStatus,
} from "./receivables-db";
import {
  listSales,
  createSale,
} from "./sales-db";

function parseAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const normalized = trimmed.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed * 100));
  }
  return 0;
}

const VALID_METHODS: PaymentMethod[] = [
  "pix",
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "transferencia",
  "boleto",
  "outro",
];

function normalizeMethod(v: unknown): PaymentMethod | null {
  if (typeof v !== "string") return null;
  return VALID_METHODS.includes(v as PaymentMethod) ? (v as PaymentMethod) : null;
}

const VALID_STATUS: ReceivableStatus[] = ["pendente", "pago", "cancelado"];

function normalizeStatus(v: unknown): ReceivableStatus | undefined {
  if (typeof v !== "string") return undefined;
  return VALID_STATUS.includes(v as ReceivableStatus)
    ? (v as ReceivableStatus)
    : undefined;
}

export function buildWorkspaceService(userId: string): WorkspaceService {
  return {
    // ------ Clients ------
    listClients: (search) => listClients(userId, search),
    createClient: (data) =>
      createClient(userId, {
        name: data.name,
        phone: data.phone,
        email: data.email,
        notes: data.notes,
      }),
    updateClient: (id, data) => updateClient(userId, id, data),
    deleteClient: (id) => deleteClient(userId, id),

    // ------ Catalog ------
    listCatalogItems: () => listCatalogItems(userId),
    createCatalogItem: (data) =>
      createCatalogItem(userId, {
        name: data.name,
        description: data.description ?? null,
        kind: (data.kind as CatalogKind) || "servico",
        price_cents: parseAmount(data.price),
        duration_minutes: data.durationMinutes ?? null,
        active: data.active === false ? 0 : 1,
      }),
    updateCatalogItem: (id, data) => {
      const patch: Parameters<typeof updateCatalogItem>[2] = {};
      if (data.name !== undefined) patch.name = data.name;
      if (data.description !== undefined) patch.description = data.description;
      if (data.kind !== undefined) patch.kind = data.kind as CatalogKind;
      if (data.price !== undefined) patch.price_cents = parseAmount(data.price);
      if (data.durationMinutes !== undefined) {
        patch.duration_minutes = data.durationMinutes;
      }
      if (data.active !== undefined) patch.active = data.active ? 1 : 0;
      return updateCatalogItem(userId, id, patch);
    },
    deleteCatalogItem: (id) => deleteCatalogItem(userId, id),

    // ------ Receivables ------
    listReceivables: (status) => {
      const s = normalizeStatus(status);
      return listReceivables(userId, s ? { status: s } : undefined);
    },
    getReceivablesSummary: () => getReceivablesSummary(userId),
    createReceivable: (data) =>
      createReceivable(userId, {
        client_name: data.clientName,
        item_name: data.itemName,
        amount_cents: parseAmount(data.amount),
        service_date: data.serviceDate,
        due_date: data.dueDate || data.serviceDate,
        payment_method: normalizeMethod(data.paymentMethod),
        notes: data.notes ?? null,
      }),
    markReceivablePaid: (id, data) => {
      const method = normalizeMethod(data.paymentMethod);
      if (!method) {
        throw new Error("Forma de pagamento inválida");
      }
      const patch: Parameters<typeof updateReceivable>[2] = {
        status: "pago",
        payment_method: method,
        paid_at: data.paidAt || new Date().toISOString(),
      };
      if (data.amount !== undefined) patch.amount_cents = parseAmount(data.amount);
      return updateReceivable(userId, id, patch);
    },
    deleteReceivable: (id) => deleteReceivable(userId, id),

    // ------ Sales ------
    listSales: () => listSales(userId),
    createSale: (data) => {
      let clientId: string | null = data.clientId ?? null;
      if (data.createClient && !clientId) {
        const created = createClient(userId, {
          name: data.clientName,
          phone: data.clientPhone,
          email: data.clientEmail,
        });
        clientId = created.id;
      } else if (clientId) {
        const existing = getClient(userId, clientId);
        if (!existing) clientId = null;
      }
      return createSale(userId, {
        client_id: clientId,
        client_name: data.clientName,
        client_document: data.clientDocument ?? null,
        client_email: data.clientEmail ?? null,
        client_phone: data.clientPhone ?? null,
        catalog_item_id: data.catalogItemId ?? null,
        item_name: data.itemName,
        amount_cents: parseAmount(data.amount),
        payment_method: normalizeMethod(data.paymentMethod),
        installments: Math.max(1, Math.min(60, data.installments ?? 1)),
        sale_date: data.saleDate || new Date().toISOString(),
        notes: data.notes ?? null,
      });
    },
  };
}
