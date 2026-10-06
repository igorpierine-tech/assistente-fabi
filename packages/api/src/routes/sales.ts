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
import { generateContractPdfFromSnapshot } from "../services/contract-pdf";
import {
  createDocumentFromPdf,
  getDocumentStatus,
  isConfigured as isZapSignConfigured,
} from "../services/zapsign";
import { requireUser, sharedOwnerId } from "../middleware/auth";
import { createClient, getClient, getTenantConfig } from "../services/database";
import {
  createContract,
  getContractBySaleId,
  getLatestRevision,
  createRevision,
  issueRevision,
  saveArtifact,
  getArtifactByType,
  saveParty,
  updateContractStatus,
  updateContractZapSign,
  logContractEvent,
  listServiceDefinitions,
} from "../services/contracts-db";
import { composeSnapshot } from "../services/contract-composer";
import "../session-types";
import type { PaymentMethod } from "../services/receivables-db";
import {
  createReceivablesFromSale,
  deleteReceivablesBySaleId,
} from "../services/receivables-db";

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

  const saleData = {
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
  };
  const sale = createSale(userId(req), saleData);

  try {
    createReceivablesFromSale(userId(req), {
      id: sale.id,
      client_id: sale.client_id,
      client_name: sale.client_name,
      item_name: sale.item_name,
      amount_cents: sale.amount_cents,
      payment_method: sale.payment_method as PaymentMethod | null,
      installments: sale.installments,
      sale_date: sale.sale_date,
    });
  } catch (_) { /* receivable generation should not block sale creation */ }

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

  const needsRecalc =
    patch.amount_cents !== undefined ||
    patch.installments !== undefined ||
    patch.payment_method !== undefined ||
    patch.sale_date !== undefined;

  const updated = updateSale(userId(req), id, patch);

  if (needsRecalc && updated) {
    try {
      deleteReceivablesBySaleId(userId(req), id);
      createReceivablesFromSale(userId(req), {
        id: updated.id,
        client_id: updated.client_id,
        client_name: updated.client_name,
        item_name: updated.item_name,
        amount_cents: updated.amount_cents,
        payment_method: updated.payment_method as PaymentMethod | null,
        installments: updated.installments,
        sale_date: updated.sale_date,
      });
    } catch (_) { /* should not block sale update */ }
  }

  res.json(updated);
});

router.delete("/:id", (req, res) => {
  const id = String(req.params.id);
  deleteReceivablesBySaleId(userId(req), id);
  const ok = deleteSale(userId(req), id);
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
    const defs = listServiceDefinitions();
    const match = defs.find(d => sale.item_name.toLowerCase().includes(d.name.toLowerCase().split(" ")[0].toLowerCase()));
    const serviceCode = match?.code || defs[0]?.code || "generico";

    const client = sale.client_id ? getClient(userId(req), sale.client_id) : null;
    const tenant = getTenantConfig(userId(req));

    const contract = createContract(userId(req), {
      saleId: sale.id,
      serviceCode,
      clientId: sale.client_id || undefined,
    });

    const snapshot = composeSnapshot({
      sale,
      client,
      tenant,
      contractNumber: contract.contract_number,
      revision: 1,
    });

    const revision = createRevision(contract.id, {
      revisionNumber: 1,
      snapshot: JSON.stringify(snapshot),
    });

    saveParty(revision.id, {
      role: "contratante",
      name: snapshot.contratante.nome,
      document: snapshot.contratante.documento || undefined,
      email: snapshot.contratante.email || undefined,
      phone: snapshot.contratante.telefone || undefined,
    });

    saveParty(revision.id, {
      role: "contratada",
      name: snapshot.contratada.razao_social,
      document: snapshot.contratada.cnpj || undefined,
      email: snapshot.contratada.email || undefined,
      address: snapshot.contratada.endereco || undefined,
      representativeName: snapshot.contratada.representante_nome || undefined,
      representativeRole: snapshot.contratada.representante_cargo || undefined,
    });

    const pdf = await generateContractPdfFromSnapshot(snapshot);
    saveArtifact(revision.id, "original_pdf", pdf);
    issueRevision(revision.id, 30);
    updateContractStatus(userId(req), contract.id, "issued");
    markContractGenerated(userId(req), id);

    logContractEvent({
      userId: userId(req),
      contractId: contract.id,
      revisionId: revision.id,
      action: "contract_created_from_sale",
      details: { saleId: sale.id },
    });

    const safeName = sale.client_name.replace(/[^a-zA-Z0-9\-_ ]/g, "").slice(0, 40) || "contrato";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Contrato-${contract.contract_number.replace("/", "-")}-${safeName}.pdf"`
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
    let existingContract = getContractBySaleId(userId(req), id);

    if (!existingContract) {
      const defs = listServiceDefinitions();
      const match = defs.find(d => sale.item_name.toLowerCase().includes(d.name.toLowerCase().split(" ")[0].toLowerCase()));
      const serviceCode = match?.code || defs[0]?.code || "generico";
      const client = sale.client_id ? getClient(userId(req), sale.client_id) : null;
      const tenant = getTenantConfig(userId(req));

      existingContract = createContract(userId(req), {
        saleId: sale.id,
        serviceCode,
        clientId: sale.client_id || undefined,
      });

      const snapshot = composeSnapshot({
        sale,
        client,
        tenant,
        contractNumber: existingContract.contract_number,
        revision: 1,
      });

      const rev = createRevision(existingContract.id, {
        revisionNumber: 1,
        snapshot: JSON.stringify(snapshot),
      });

      saveParty(rev.id, {
        role: "contratante",
        name: snapshot.contratante.nome,
        document: snapshot.contratante.documento || undefined,
        email: snapshot.contratante.email || undefined,
        phone: snapshot.contratante.telefone || undefined,
      });

      saveParty(rev.id, {
        role: "contratada",
        name: snapshot.contratada.razao_social,
        document: snapshot.contratada.cnpj || undefined,
        email: snapshot.contratada.email || undefined,
        address: snapshot.contratada.endereco || undefined,
        representativeName: snapshot.contratada.representante_nome || undefined,
        representativeRole: snapshot.contratada.representante_cargo || undefined,
      });

      const pdf = await generateContractPdfFromSnapshot(snapshot);
      saveArtifact(rev.id, "original_pdf", pdf);
      issueRevision(rev.id, 30);
      updateContractStatus(userId(req), existingContract.id, "issued");
    }

    markContractGenerated(userId(req), id);

    const revision = getLatestRevision(existingContract.id);
    let pdf: Buffer;
    const existingArtifact = revision ? getArtifactByType(revision.id, "original_pdf") : null;
    if (existingArtifact?.content) {
      pdf = existingArtifact.content;
    } else {
      const fallbackSnapshot = revision ? JSON.parse(revision.snapshot) : composeSnapshot({
        sale,
        client: sale.client_id ? getClient(userId(req), sale.client_id) : null,
        tenant: getTenantConfig(userId(req)),
        contractNumber: existingContract.contract_number,
        revision: 1,
      });
      pdf = await generateContractPdfFromSnapshot(fallbackSnapshot);
    }

    const providerName = process.env.CONTRACT_PROVIDER_NAME || "Prestador de Serviços";
    const providerEmail = process.env.CONTRACT_PROVIDER_EMAIL || "";

    const signers = [
      { name: sale.client_name, email: sale.client_email, phone: sale.client_phone || undefined },
    ];
    if (providerEmail) {
      signers.push({ name: providerName, email: providerEmail, phone: undefined });
    }

    const docName = `Contrato ${existingContract.contract_number} - ${sale.client_name}`;
    const result = await createDocumentFromPdf(pdf, docName, signers);

    const clientSigner = result.signers[0];
    updateZapSignStatus(userId(req), id, result.token, "pending", clientSigner?.sign_url || null);
    updateContractZapSign(userId(req), existingContract.id, result.token, "pending", clientSigner?.sign_url || null);
    updateContractStatus(userId(req), existingContract.id, "awaiting_signature");

    logContractEvent({
      userId: userId(req),
      contractId: existingContract.id,
      action: "sent_to_zapsign",
      details: { saleId: sale.id, docToken: result.token },
    });

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
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Falha ao enviar para ZapSign:", msg, err);
    res.status(500).json({ error: `Não foi possível enviar o contrato para assinatura. Detalhe: ${msg}` });
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
      const linkedContract = getContractBySaleId(userId(req), id);
      if (linkedContract?.zapsign_doc_token === sale.zapsign_doc_token) {
        updateContractZapSign(userId(req), linkedContract.id, sale.zapsign_doc_token, newStatus, linkedContract.zapsign_sign_url);
        if (newStatus === "signed") {
          updateContractStatus(userId(req), linkedContract.id, "completed");
        }
      }
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

  const linkedContract = getContractBySaleId(sale.user_id, sale.id);
  if (linkedContract?.zapsign_doc_token === body.doc_token) {
    updateContractZapSign(sale.user_id, linkedContract.id, body.doc_token, newStatus, linkedContract.zapsign_sign_url);
    if (newStatus === "signed") {
      updateContractStatus(sale.user_id, linkedContract.id, "completed");
    }
  }

  res.json({ ok: true });
});

export { webhookRouter as zapSignWebhookRouter };
