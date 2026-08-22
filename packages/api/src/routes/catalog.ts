import { Router, type Request, type Router as ExpressRouter } from "express";
import {
  listCatalogItems,
  getCatalogItem,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  type CatalogKind,
} from "../services/catalog-db";
import { requireUser, sharedOwnerId } from "../middleware/auth";
import "../session-types";

const router: ExpressRouter = Router();
router.use(requireUser);

function userId(req: Request): string {
  return sharedOwnerId(req);
}

function parseKind(value: unknown): CatalogKind {
  return value === "produto" ? "produto" : "servico";
}

function parsePriceCents(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    // Accept "12,50" or "12.50" as BRL
    const normalized = trimmed.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed * 100));
    }
  }
  return 0;
}

function parseDuration(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(600, Math.max(5, Math.round(n)));
}

router.get("/", (req, res) => {
  res.json(listCatalogItems(userId(req)));
});

router.post("/", (req, res) => {
  const b = req.body as {
    name?: string;
    description?: string | null;
    kind?: unknown;
    priceCents?: unknown;
    price?: unknown;
    durationMinutes?: unknown;
    active?: boolean;
    sortOrder?: number;
  } | null;
  if (!b || typeof b.name !== "string" || !b.name.trim()) {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }
  const kind = parseKind(b.kind);
  const price_cents = parsePriceCents(b.priceCents ?? b.price);
  const duration_minutes = kind === "servico" ? parseDuration(b.durationMinutes) : null;
  const item = createCatalogItem(userId(req), {
    name: b.name.trim().slice(0, 160),
    description: b.description ? String(b.description).slice(0, 1000) : null,
    kind,
    price_cents,
    duration_minutes,
    active: b.active === false ? 0 : 1,
    sort_order: typeof b.sortOrder === "number" ? b.sortOrder : 0,
  });
  res.status(201).json(item);
});

router.put("/:id", (req, res) => {
  const id = String(req.params.id);
  const existing = getCatalogItem(userId(req), id);
  if (!existing) {
    res.status(404).json({ error: "Item não encontrado" });
    return;
  }
  const b = req.body as {
    name?: string;
    description?: string | null;
    kind?: unknown;
    priceCents?: unknown;
    price?: unknown;
    durationMinutes?: unknown;
    active?: boolean;
    sortOrder?: number;
  } | null;
  if (!b) {
    res.status(400).json({ error: "Body inválido" });
    return;
  }
  const patch: Parameters<typeof updateCatalogItem>[2] = {};
  if (typeof b.name === "string") {
    if (!b.name.trim()) {
      res.status(400).json({ error: "Nome não pode ser vazio" });
      return;
    }
    patch.name = b.name.trim().slice(0, 160);
  }
  if (b.description !== undefined) {
    patch.description = b.description ? String(b.description).slice(0, 1000) : null;
  }
  if (b.kind !== undefined) patch.kind = parseKind(b.kind);
  if (b.priceCents !== undefined || b.price !== undefined) {
    patch.price_cents = parsePriceCents(b.priceCents ?? b.price);
  }
  if (b.durationMinutes !== undefined) {
    patch.duration_minutes = parseDuration(b.durationMinutes);
  }
  if (b.active !== undefined) patch.active = b.active ? 1 : 0;
  if (typeof b.sortOrder === "number") patch.sort_order = b.sortOrder;
  const updated = updateCatalogItem(userId(req), id, patch);
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  const ok = deleteCatalogItem(userId(req), String(req.params.id));
  if (!ok) {
    res.status(404).json({ error: "Item não encontrado" });
    return;
  }
  res.status(204).end();
});

export { router as catalogRouter };
