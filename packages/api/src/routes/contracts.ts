import { Router, type Request, type Router as ExpressRouter } from "express";
import { requireUser, sharedOwnerId } from "../middleware/auth";
import {
  listServiceDefinitions,
  getServiceDefinition,
  listContractsWithDetails,
  getContract,
  createContract,
  updateContractStatus,
  getLatestRevision,
  createRevision,
  updateRevisionSnapshot,
  issueRevision,
  saveArtifact,
  getArtifactByType,
  saveParty,
  listParties,
  logContractEvent,
  listRevisions,
} from "../services/contracts-db";
import { getSale } from "../services/sales-db";
import { getClient, getTenantConfig } from "../services/database";
import { composeSnapshot } from "../services/contract-composer";
import { generateContractPdfFromSnapshot } from "../services/contract-pdf";
import "../session-types";

const router: ExpressRouter = Router();
router.use(requireUser);

function userId(req: Request): string {
  return sharedOwnerId(req);
}

router.get("/services", (_req, res) => {
  res.json(listServiceDefinitions());
});

router.get("/services/:code", (req, res) => {
  const def = getServiceDefinition(String(req.params.code));
  if (!def) {
    res.status(404).json({ error: "Serviço não encontrado" });
    return;
  }
  res.json(def);
});

router.get("/", (req, res) => {
  const filters: { status?: string; serviceCode?: string } = {};
  if (typeof req.query.status === "string") filters.status = req.query.status;
  if (typeof req.query.serviceCode === "string") filters.serviceCode = req.query.serviceCode;
  res.json(listContractsWithDetails(userId(req), filters));
});

router.get("/:id", (req, res) => {
  const contract = getContract(userId(req), String(req.params.id));
  if (!contract) {
    res.status(404).json({ error: "Contrato não encontrado" });
    return;
  }
  const revision = getLatestRevision(contract.id);
  const parties = revision ? listParties(revision.id) : [];
  const revisions = listRevisions(contract.id);
  const service = getServiceDefinition(contract.service_code);
  res.json({ contract, revision, parties, revisions, service });
});

router.post("/", async (req, res) => {
  const b = req.body as {
    saleId?: string;
    serviceCode?: string;
    clientId?: string;
    especifico?: Record<string, unknown>;
  } | null;

  if (!b) {
    res.status(400).json({ error: "Body inválido" });
    return;
  }

  let serviceCode = b.serviceCode;
  let clientId = b.clientId;
  let sale = b.saleId ? getSale(userId(req), b.saleId) : null;

  if (sale && !serviceCode) {
    const defs = listServiceDefinitions();
    const match = defs.find(d => sale!.item_name.toLowerCase().includes(d.name.toLowerCase().split(" ")[0].toLowerCase()));
    serviceCode = match?.code;
  }

  if (!serviceCode) {
    res.status(400).json({ error: "Código do serviço é obrigatório (serviceCode)" });
    return;
  }

  const serviceDef = getServiceDefinition(serviceCode);
  if (!serviceDef) {
    res.status(400).json({ error: `Serviço não encontrado: ${serviceCode}` });
    return;
  }

  if (sale && !clientId) clientId = sale.client_id || undefined;

  const contract = createContract(userId(req), {
    saleId: sale?.id,
    serviceCode,
    clientId,
  });

  logContractEvent({
    userId: userId(req),
    contractId: contract.id,
    action: "contract_created",
    details: { serviceCode, saleId: sale?.id },
  });

  const client = clientId ? getClient(userId(req), clientId) : null;
  const tenant = getTenantConfig(userId(req));

  if (!sale) {
    sale = {
      id: "",
      user_id: userId(req),
      client_id: clientId || null,
      client_name: client?.name || "[Nome do cliente]",
      client_document: null,
      client_email: client?.email || null,
      client_phone: client?.phone || null,
      catalog_item_id: null,
      item_name: serviceDef.name,
      amount_cents: 0,
      payment_method: null,
      installments: 1,
      sale_date: new Date().toISOString(),
      notes: null,
      contract_generated_at: null,
      zapsign_doc_token: null,
      zapsign_status: null,
      zapsign_sign_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const snapshot = composeSnapshot({
    sale,
    client,
    tenant,
    contractNumber: contract.contract_number,
    revision: 1,
    especifico: b.especifico,
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

  res.status(201).json({
    contract,
    revision,
    snapshot,
  });
});

router.put("/:id/snapshot", (req, res) => {
  const contract = getContract(userId(req), String(req.params.id));
  if (!contract) {
    res.status(404).json({ error: "Contrato não encontrado" });
    return;
  }
  if (contract.status !== "draft") {
    res.status(400).json({ error: "Somente contratos em rascunho podem ser editados" });
    return;
  }

  const revision = getLatestRevision(contract.id);
  if (!revision) {
    res.status(400).json({ error: "Contrato sem revisão" });
    return;
  }

  const b = req.body as {
    contratante?: {
      nome?: string;
      documento?: string;
      email?: string;
      telefone?: string;
      endereco?: string;
      tipo_pessoa?: string;
      inscricao_estadual?: string;
    };
    financeiro?: {
      valor_total_centavos?: number;
      forma_pagamento?: string;
      parcelas?: number;
    };
    clausulas?: Array<{ id: string; titulo: string; texto: string }>;
  } | null;

  if (!b) {
    res.status(400).json({ error: "Body inválido" });
    return;
  }

  const snapshot = JSON.parse(revision.snapshot);

  if (b.contratante) {
    Object.assign(snapshot.contratante, b.contratante);
    snapshot.quadro_resumo.contratante = snapshot.contratante.nome;
  }

  if (b.financeiro) {
    if (b.financeiro.valor_total_centavos !== undefined) {
      snapshot.financeiro.valor_total_centavos = b.financeiro.valor_total_centavos;
      const formatBRL = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      snapshot.quadro_resumo.valor = formatBRL(b.financeiro.valor_total_centavos);
    }
    if (b.financeiro.forma_pagamento !== undefined) snapshot.financeiro.forma_pagamento = b.financeiro.forma_pagamento;
    if (b.financeiro.parcelas !== undefined) snapshot.financeiro.parcelas = b.financeiro.parcelas;

    const methodLabels: Record<string, string> = { pix: "PIX", dinheiro: "Dinheiro", cartao_credito: "Cartão de crédito", cartao_debito: "Cartão de débito", transferencia: "Transferência bancária", boleto: "Boleto bancário", outro: "Outro" };
    const method = snapshot.financeiro.forma_pagamento;
    const label = methodLabels[method] || method || "A combinar";
    const inst = snapshot.financeiro.parcelas;
    const formatBRL = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    snapshot.financeiro.resumo_pagamento = `${formatBRL(snapshot.financeiro.valor_total_centavos)} via ${inst > 1 ? `${label} em ${inst}x` : label}`;
    snapshot.quadro_resumo.pagamento = snapshot.financeiro.resumo_pagamento;
  }

  if (b.clausulas) {
    const isAdesao = snapshot.service_code === "mentoria_adesao";
    if (isAdesao) {
      snapshot.modulo_especifico = b.clausulas;
    } else {
      const baseIds = new Set(snapshot.clausulas_base.map((c: { id: string }) => c.id));
      const updatedBase = b.clausulas.filter(c => baseIds.has(c.id));
      const updatedModule = b.clausulas.filter(c => !baseIds.has(c.id));
      if (updatedBase.length > 0) snapshot.clausulas_base = updatedBase;
      if (updatedModule.length > 0) snapshot.modulo_especifico = updatedModule;
    }
  }

  updateRevisionSnapshot(revision.id, JSON.stringify(snapshot));

  logContractEvent({
    userId: userId(req),
    contractId: contract.id,
    revisionId: revision.id,
    action: "snapshot_updated",
  });

  res.json({ success: true, snapshot });
});

router.post("/:id/issue", async (req, res) => {
  const contract = getContract(userId(req), String(req.params.id));
  if (!contract) {
    res.status(404).json({ error: "Contrato não encontrado" });
    return;
  }

  if (contract.status !== "draft") {
    res.status(400).json({ error: `Contrato em status '${contract.status}' não pode ser emitido. Apenas rascunhos podem ser emitidos.` });
    return;
  }

  const revision = getLatestRevision(contract.id);
  if (!revision) {
    res.status(400).json({ error: "Contrato sem revisão" });
    return;
  }

  const snapshot = JSON.parse(revision.snapshot);

  if (!snapshot.contratante.nome || snapshot.contratante.nome === "[Nome do cliente]") {
    res.status(400).json({ error: "Dados do contratante incompletos" });
    return;
  }

  if (snapshot.financeiro.valor_total_centavos <= 0) {
    res.status(400).json({ error: "Valor do contrato deve ser maior que zero" });
    return;
  }

  try {
    const pdf = await generateContractPdfFromSnapshot(snapshot);
    saveArtifact(revision.id, "original_pdf", pdf);
    issueRevision(revision.id, 30);
    updateContractStatus(userId(req), contract.id, "issued");

    logContractEvent({
      userId: userId(req),
      contractId: contract.id,
      revisionId: revision.id,
      action: "contract_issued",
    });

    res.json({ success: true, status: "issued" });
  } catch (err) {
    console.error("Falha ao emitir contrato:", err);
    res.status(500).json({ error: "Não foi possível emitir o contrato" });
  }
});

router.get("/:id/pdf", async (req, res) => {
  const contract = getContract(userId(req), String(req.params.id));
  if (!contract) {
    res.status(404).json({ error: "Contrato não encontrado" });
    return;
  }

  const revision = getLatestRevision(contract.id);
  if (!revision) {
    res.status(404).json({ error: "Contrato sem revisão" });
    return;
  }

  const existing = getArtifactByType(revision.id, "original_pdf");
  if (existing?.content) {
    const snapshot = JSON.parse(revision.snapshot);
    const safeName = snapshot.contratante.nome.replace(/[^a-zA-Z0-9\-_ ]/g, "").slice(0, 40) || "contrato";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Contrato-${contract.contract_number.replace("/", "-")}-${safeName}.pdf"`);
    res.setHeader("Content-Length", String(existing.content.length));
    res.end(existing.content);
    return;
  }

  try {
    const snapshot = JSON.parse(revision.snapshot);
    const pdf = await generateContractPdfFromSnapshot(snapshot);
    const safeName = snapshot.contratante.nome.replace(/[^a-zA-Z0-9\-_ ]/g, "").slice(0, 40) || "contrato";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Contrato-${contract.contract_number.replace("/", "-")}-${safeName}.pdf"`);
    res.setHeader("Content-Length", String(pdf.length));
    res.end(pdf);
  } catch (err) {
    console.error("Falha ao gerar PDF:", err);
    res.status(500).json({ error: "Não foi possível gerar o PDF" });
  }
});

router.post("/:id/void", (req, res) => {
  const contract = getContract(userId(req), String(req.params.id));
  if (!contract) {
    res.status(404).json({ error: "Contrato não encontrado" });
    return;
  }
  if (contract.status === "completed") {
    res.status(400).json({ error: "Contrato concluído não pode ser cancelado diretamente" });
    return;
  }
  updateContractStatus(userId(req), contract.id, "voided");
  logContractEvent({
    userId: userId(req),
    contractId: contract.id,
    action: "contract_voided",
  });
  res.json({ success: true, status: "voided" });
});

export { router as contractsRouter };
