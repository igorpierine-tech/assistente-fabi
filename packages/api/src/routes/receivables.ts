import { Router, type Request, type Router as ExpressRouter } from "express";
import {
  listReceivables,
  getReceivable,
  createReceivable,
  updateReceivable,
  deleteReceivable,
  getReceivablesSummary,
  type PaymentMethod,
  type ReceivableStatus,
} from "../services/receivables-db";
import { requireUser } from "../middleware/auth";
import "../session-types";

const router: ExpressRouter = Router();
router.use(requireUser);

function userId(req: Request): string {
  return req.session.googleUser!.id;
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

const VALID_STATUS: ReceivableStatus[] = ["pendente", "pago", "cancelado"];

function parsePaymentMethod(value: unknown): PaymentMethod | null {
  if (typeof value !== "string") return null;
  return VALID_METHODS.includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : null;
}

function parseStatus(value: unknown): ReceivableStatus | undefined {
  if (typeof value !== "string") return undefined;
  return VALID_STATUS.includes(value as ReceivableStatus)
    ? (value as ReceivableStatus)
    : undefined;
}

function parseAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const normalized = trimmed.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed * 100));
    }
  }
  return 0;
}

router.get("/", (req, res) => {
  const status = parseStatus(req.query.status);
  res.json(listReceivables(userId(req), status ? { status } : undefined));
});

router.get("/summary", (req, res) => {
  res.json(getReceivablesSummary(userId(req)));
});

router.post("/", (req, res) => {
  const b = req.body as {
    clientName?: string;
    clientId?: string | null;
    itemName?: string;
    catalogItemId?: string | null;
    amount?: unknown;
    amountCents?: unknown;
    serviceDate?: string;
    dueDate?: string;
    paymentMethod?: unknown;
    status?: unknown;
    paidAt?: string | null;
    notes?: string | null;
  } | null;
  if (!b || !b.clientName?.trim() || !b.itemName?.trim() || !b.serviceDate) {
    res.status(400).json({ error: "Cliente, item e data são obrigatórios" });
    return;
  }
  const item = createReceivable(userId(req), {
    client_id: b.clientId ?? null,
    client_name: b.clientName.trim().slice(0, 160),
    catalog_item_id: b.catalogItemId ?? null,
    item_name: b.itemName.trim().slice(0, 160),
    amount_cents: parseAmount(b.amountCents ?? b.amount),
    service_date: b.serviceDate,
    due_date: b.dueDate || b.serviceDate,
    payment_method: parsePaymentMethod(b.paymentMethod),
    status: parseStatus(b.status) ?? "pendente",
    paid_at: b.paidAt ?? null,
    notes: b.notes ? String(b.notes).slice(0, 1000) : null,
  });
  res.status(201).json(item);
});

router.put("/:id", (req, res) => {
  const id = String(req.params.id);
  const existing = getReceivable(userId(req), id);
  if (!existing) {
    res.status(404).json({ error: "Item não encontrado" });
    return;
  }
  const b = req.body as {
    clientName?: string;
    clientId?: string | null;
    itemName?: string;
    catalogItemId?: string | null;
    amount?: unknown;
    amountCents?: unknown;
    serviceDate?: string;
    dueDate?: string;
    paymentMethod?: unknown;
    status?: unknown;
    paidAt?: string | null;
    notes?: string | null;
  } | null;
  if (!b) {
    res.status(400).json({ error: "Body inválido" });
    return;
  }
  const patch: Parameters<typeof updateReceivable>[2] = {};
  if (b.clientName !== undefined) patch.client_name = b.clientName.trim().slice(0, 160);
  if (b.clientId !== undefined) patch.client_id = b.clientId;
  if (b.itemName !== undefined) patch.item_name = b.itemName.trim().slice(0, 160);
  if (b.catalogItemId !== undefined) patch.catalog_item_id = b.catalogItemId;
  if (b.amount !== undefined || b.amountCents !== undefined) {
    patch.amount_cents = parseAmount(b.amountCents ?? b.amount);
  }
  if (b.serviceDate !== undefined) patch.service_date = b.serviceDate;
  if (b.dueDate !== undefined) patch.due_date = b.dueDate;
  if (b.paymentMethod !== undefined) patch.payment_method = parsePaymentMethod(b.paymentMethod);
  if (b.status !== undefined) {
    const s = parseStatus(b.status);
    if (s) patch.status = s;
  }
  if (b.paidAt !== undefined) patch.paid_at = b.paidAt;
  if (b.notes !== undefined) patch.notes = b.notes ? String(b.notes).slice(0, 1000) : null;
  res.json(updateReceivable(userId(req), id, patch));
});

router.post("/:id/mark-paid", (req, res) => {
  const id = String(req.params.id);
  const existing = getReceivable(userId(req), id);
  if (!existing) {
    res.status(404).json({ error: "Item não encontrado" });
    return;
  }
  const b = req.body as {
    paymentMethod?: unknown;
    paidAt?: string;
    amount?: unknown;
    amountCents?: unknown;
  } | null;
  const method = parsePaymentMethod(b?.paymentMethod);
  if (!method) {
    res.status(400).json({ error: "Forma de pagamento inválida" });
    return;
  }
  const paidAt = b?.paidAt || new Date().toISOString();
  const patch: Parameters<typeof updateReceivable>[2] = {
    status: "pago",
    payment_method: method,
    paid_at: paidAt,
  };
  if (b?.amount !== undefined || b?.amountCents !== undefined) {
    patch.amount_cents = parseAmount(b.amountCents ?? b.amount);
  }
  res.json(updateReceivable(userId(req), id, patch));
});

router.post("/:id/mark-pending", (req, res) => {
  const id = String(req.params.id);
  const existing = getReceivable(userId(req), id);
  if (!existing) {
    res.status(404).json({ error: "Item não encontrado" });
    return;
  }
  res.json(
    updateReceivable(userId(req), id, {
      status: "pendente",
      paid_at: null,
    })
  );
});

router.delete("/:id", (req, res) => {
  const ok = deleteReceivable(userId(req), String(req.params.id));
  if (!ok) {
    res.status(404).json({ error: "Item não encontrado" });
    return;
  }
  res.status(204).end();
});

export { router as receivablesRouter };
