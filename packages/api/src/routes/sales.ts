import { Router, type Request, type Router as ExpressRouter } from "express";
import {
  listSales,
  getSale,
  createSale,
  updateSale,
  deleteSale,
  markContractGenerated,
  updateZapSignStatus,
  getSaleByZapSignToken,
} from "../services/sales-db";
import { generateContractPdf } from "../services/contract-pdf";
import {
  createDocumentFromPdf,
  getDocumentStatus,
  isConfigured as isZapSignConfigured,
} from "../services/zapsign";
import { requireUser, sharedOwnerId } from "../middleware/auth";
import { createClient, getClient } from "../services/database";
import "../session-types";
import type { PaymentMethod } from "../services/receivables-db";

const router: ExpressRouter = Router();
router.use(requireUser);

function userId(req: Request): string {
  return sharedOwnerId(req);
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

function parsePaymentMethod(value: unknown): PaymentMethod | null {
  if (typeof value !== "string") return null;
  return VALID_METHODS.includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : null;
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
    if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed * 100));
  }
  return 0;
}

router.get("/", (req, res) => {
  res.json(listSales(userId(req)));
});

router.get("/:id", (req, res) => {
  const sale = getSale(userId(req), String(req.params.id));
  if (!sale) {
    res.status(404).json({ error: "Venda não encontrada" });
    return;
  }
  res.json(sale);
});

router.post("/", (req, res) => {
  const b = req.body as {
    clientId?: string | null;
    // If clientId not provided but createClient=true, we create a new client from these fields
    createClient?: boolean;
    clientName?: string;
    clientDocument?: string | null;
    clientEmail?: string | null;
    clientPhone?: string | null;
    catalogItemId?: string | null;
    itemName?: string;
    amount?: unknown;
    amountCents?: unknown;
    paymentMethod?: unknown;
    installments?: number;
    saleDate?: string;
    notes?: string | null;
  } | null;

  if (!b || !b.clientName?.trim() || !b.itemName?.trim()) {
    res.status(400).json({ error: "Cliente e item são obrigatórios" });
    return;
  }

  let clientId: string | null = b.clientId ?? null;

  if (b.createClient && !clientId) {
    const created = createClient(userId(req), {
      name: b.clientName.trim(),
      phone: b.clientPhone?.trim() || undefined,
      email: b.clientEmail?.trim() || undefined,
    });
    clientId = created.id;
  } else if (clientId) {
    const existing = getClient(userId(req), clientId);
    if (!existing) clientId = null;
  }

  const sale = createSale(userId(req), {
    client_id: clientId,
    client_name: b.clientName.trim().slice(0, 160),
    client_document: b.clientDocument ? String(b.clientDocument).slice(0, 32) : null,
    client_email: b.clientEmail ? String(b.clientEmail).slice(0, 160) : null,
    client_phone: b.clientPhone ? String(b.clientPhone).slice(0, 32) : null,
    catalog_item_id: b.catalogItemId ?? null,
    item_name: b.itemName.trim().slice(0, 160),
    amount_cents: parseAmount(b.amountCents ?? b.amount),
    payment_method: parsePaymentMethod(b.paymentMethod),
    installments: Math.max(1, Math.min(60, Number(b.installments) || 1)),
    sale_date: b.saleDate || new Date().toISOString(),
    notes: b.notes ? String(b.notes).slice(0, 2000) : null,
  });
  res.status(201).json(sale);
});

router.put("/:id", (req, res) => {
  const id = String(req.params.id);
  const existing = getSale(userId(req), id);
  if (!existing) {
    res.status(404).json({ error: "Venda não encontrada" });
    return;
  }
  const b = req.body as Record<string, unknown> | null;
  if (!b) {
    res.status(400).json({ error: "Body inválido" });
    return;
  }
  const patch: Parameters<typeof updateSale>[2] = {};
  if (typeof b.clientId === "string" || b.clientId === null) patch.client_id = b.clientId as string | null;
  if (typeof b.clientName === "string") patch.client_name = b.clientName.trim().slice(0, 160);
  if (b.clientDocument !== undefined)
    patch.client_document = b.clientDocument ? String(b.clientDocument).slice(0, 32) : null;
  if (b.clientEmail !== undefined)
    patch.client_email = b.clientEmail ? String(b.clientEmail).slice(0, 160) : null;
  if (b.clientPhone !== undefined)
    patch.client_phone = b.clientPhone ? String(b.clientPhone).slice(0, 32) : null;
  if (b.catalogItemId !== undefined) patch.catalog_item_id = (b.catalogItemId as string | null) ?? null;
  if (typeof b.itemName === "string") patch.item_name = b.itemName.trim().slice(0, 160);
  if (b.amount !== undefined || b.amountCents !== undefined) {
    patch.amount_cents = parseAmount(b.amountCents ?? b.amount);
  }
  if (b.paymentMethod !== undefined) patch.payment_method = parsePaymentMethod(b.paymentMethod);
  if (b.installments !== undefined)
    patch.installments = Math.max(1, Math.min(60, Number(b.installments) || 1));
  if (typeof b.saleDate === "string") patch.sale_date = b.saleDate;
  if (b.notes !== undefined) patch.notes = b.notes ? String(b.notes).slice(0, 2000) : null;
  res.json(updateSale(userId(req), id, patch));
});

router.delete("/:id", (req, res) => {
  const ok = deleteSale(userId(req), String(req.params.id));
  if (!ok) {
    res.status(404).json({ error: "Venda não encontrada" });
    return;
  }
  res.status(204).end();
});

router.get("/:id/contract", async (req, res) => {
  const id = String(req.params.id);
  const sale = getSale(userId(req), id);
  if (!sale) {
    res.status(404).json({ error: "Venda não encontrada" });
    return;
  }
  try {
    const pdf = await generateContractPdf(sale);
    markContractGenerated(userId(req), id);
    const safeName = sale.client_name.replace(/[^a-zA-Z0-9\-_ ]/g, "").slice(0, 40) || "contrato";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Contrato-${safeName}.pdf"`
    );
    res.setHeader("Content-Length", String(pdf.length));
    res.end(pdf);
  } catch (err) {
    console.error("Falha ao gerar contrato:", err);
    res.status(500).json({ error: "Não foi possível gerar o contrato" });
  }
});

router.get("/zapsign/status", (_req, res) => {
  res.json({ configured: isZapSignConfigured() });
});

router.post("/:id/send-signature", async (req, res) => {
  const id = String(req.params.id);
  const sale = getSale(userId(req), id);
  if (!sale) {
    res.status(404).json({ error: "Venda não encontrada" });
    return;
  }
  if (!isZapSignConfigured()) {
    res.status(400).json({ error: "ZapSign não configurado. Defina ZAPSIGN_API_TOKEN nas variáveis de ambiente." });
    return;
  }
  if (!sale.client_email) {
    res.status(400).json({ error: "O cliente precisa ter um e-mail cadastrado para receber o contrato." });
    return;
  }
  if (sale.zapsign_doc_token && sale.zapsign_status !== "cancelled") {
    res.status(400).json({ error: "Este contrato já foi enviado para assinatura." });
    return;
  }

  try {
    const pdf = await generateContractPdf(sale);
    markContractGenerated(userId(req), id);

    const providerName = process.env.CONTRACT_PROVIDER_NAME || "Prestador de Serviços";
    const providerEmail = process.env.CONTRACT_PROVIDER_EMAIL || "";

    const signers = [
      { name: sale.client_name, email: sale.client_email, phone: sale.client_phone || undefined },
    ];
    if (providerEmail) {
      signers.push({ name: providerName, email: providerEmail, phone: undefined });
    }

    const docName = `Contrato - ${sale.client_name} - ${sale.item_name}`;
    const result = await createDocumentFromPdf(pdf, docName, signers);

    const clientSigner = result.signers[0];
    updateZapSignStatus(userId(req), id, result.token, "pending", clientSigner?.sign_url || null);

    res.json({
      success: true,
      docToken: result.token,
      status: "pending",
      signUrl: clientSigner?.sign_url || null,
      signers: result.signers.map((s) => ({
        name: s.name,
        email: s.email,
        signUrl: s.sign_url,
      })),
    });
  } catch (err) {
    console.error("Falha ao enviar para ZapSign:", err);
    res.status(500).json({ error: "Não foi possível enviar o contrato para assinatura." });
  }
});

router.get("/:id/signature-status", async (req, res) => {
  const id = String(req.params.id);
  const sale = getSale(userId(req), id);
  if (!sale) {
    res.status(404).json({ error: "Venda não encontrada" });
    return;
  }
  if (!sale.zapsign_doc_token) {
    res.status(400).json({ error: "Contrato não enviado para assinatura." });
    return;
  }

  try {
    const doc = await getDocumentStatus(sale.zapsign_doc_token);
    const newStatus = doc.status === "signed" ? "signed" : doc.status === "cancelled" ? "cancelled" : "pending";
    if (newStatus !== sale.zapsign_status) {
      updateZapSignStatus(userId(req), id, sale.zapsign_doc_token, newStatus, sale.zapsign_sign_url);
    }
    res.json({
      status: newStatus,
      signers: doc.signers.map((s) => ({
        name: s.name,
        email: s.email,
        status: s.status,
        signed: s.signed,
        signUrl: s.sign_url,
      })),
      signedFile: doc.signed_file || null,
    });
  } catch (err) {
    console.error("Falha ao consultar status ZapSign:", err);
    res.status(500).json({ error: "Não foi possível consultar o status da assinatura." });
  }
});

export { router as salesRouter };

const webhookRouter: ExpressRouter = Router();
webhookRouter.post("/", (req, res) => {
  const body = req.body as { doc_token?: string; status?: string } | null;
  if (!body?.doc_token) {
    res.status(400).json({ error: "Token ausente" });
    return;
  }
  const sale = getSaleByZapSignToken(body.doc_token);
  if (!sale) {
    res.status(404).json({ error: "Documento não encontrado" });
    return;
  }
  const newStatus = body.status === "signed" ? "signed" : body.status === "cancelled" ? "cancelled" : "pending";
  updateZapSignStatus(sale.user_id, sale.id, sale.zapsign_doc_token!, newStatus, sale.zapsign_sign_url);
  res.json({ ok: true });
});

export { webhookRouter as zapSignWebhookRouter };
