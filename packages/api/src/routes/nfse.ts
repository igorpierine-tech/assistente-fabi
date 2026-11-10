import { Router, type Router as ExpressRouter } from "express";
import { requireUser, sharedOwnerId } from "../middleware/auth";
import { getTenantConfig, upsertTenantConfig, getClient } from "../services/database";
import {
  listNfseInvoices,
  getNfseInvoice,
  getNfseInvoiceBySaleId,
  createNfseInvoice,
  updateNfseInvoice,
} from "../services/nfse-db";
import { emitirNfse, consultarNfse, cancelarNfse, isNfseConfigured } from "../services/nfse";
import { getSale } from "../services/sales-db";
import { ValidationError } from "../services/validation";
import { encrypt } from "../services/crypto";
import "../session-types";

const router: ExpressRouter = Router();
router.use(requireUser);

function ownerId(req: Express.Request): string {
  return sharedOwnerId(req as import("express").Request);
}

router.get("/status", (req, res) => {
  const uid = ownerId(req);
  const config = getTenantConfig(uid);
  res.json({
    configured: config ? isNfseConfigured(config) : false,
    certificateLoaded: !!(config?.nfse_certificado_base64),
    ambiente: config?.nfse_ambiente || "homologacao",
  });
});

router.get("/config", (req, res) => {
  const uid = ownerId(req);
  const config = getTenantConfig(uid);
  if (!config) {
    res.json({});
    return;
  }
  res.json({
    codigoMunicipio: config.nfse_codigo_municipio,
    codigoTributacaoNacional: config.nfse_codigo_tributacao_nacional,
    aliquotaIss: config.nfse_aliquota_iss,
    itemListaServico: config.nfse_item_lista_servico,
    regimeEspecial: config.nfse_regime_especial,
    optanteSimples: config.nfse_optante_simples,
    ambiente: config.nfse_ambiente || "homologacao",
    certificateLoaded: !!config.nfse_certificado_base64,
    cnpj: config.cnpj,
    inscricaoMunicipal: config.inscricao_municipal,
  });
});

router.put("/config", (req, res) => {
  const uid = ownerId(req);
  const body = req.body;
  if (!body || typeof body !== "object") {
    throw new ValidationError("Corpo da requisição inválido");
  }

  const update: Record<string, unknown> = {};

  if (body.codigoMunicipio !== undefined) {
    const code = String(body.codigoMunicipio).replace(/\D/g, "");
    if (code && code.length !== 7) throw new ValidationError("Código do município deve ter 7 dígitos (IBGE)");
    update.nfse_codigo_municipio = code || null;
  }
  if (body.codigoTributacaoNacional !== undefined) {
    update.nfse_codigo_tributacao_nacional = String(body.codigoTributacaoNacional).slice(0, 10) || null;
  }
  if (body.aliquotaIss !== undefined) {
    const aliq = parseFloat(body.aliquotaIss);
    if (isNaN(aliq) || aliq < 0 || aliq > 1) throw new ValidationError("Alíquota ISS inválida (use decimal, ex: 0.05 para 5%)");
    update.nfse_aliquota_iss = aliq;
  }
  if (body.itemListaServico !== undefined) {
    update.nfse_item_lista_servico = String(body.itemListaServico).slice(0, 20) || null;
  }
  if (body.regimeEspecial !== undefined) {
    update.nfse_regime_especial = body.regimeEspecial != null ? parseInt(body.regimeEspecial) : null;
  }
  if (body.optanteSimples !== undefined) {
    update.nfse_optante_simples = parseInt(body.optanteSimples) || 1;
  }
  if (body.ambiente !== undefined) {
    if (!["producao", "homologacao"].includes(body.ambiente)) {
      throw new ValidationError("Ambiente deve ser 'producao' ou 'homologacao'");
    }
    update.nfse_ambiente = body.ambiente;
  }

  const updated = upsertTenantConfig(uid, update);
  res.json({
    codigoMunicipio: updated.nfse_codigo_municipio,
    codigoTributacaoNacional: updated.nfse_codigo_tributacao_nacional,
    aliquotaIss: updated.nfse_aliquota_iss,
    itemListaServico: updated.nfse_item_lista_servico,
    regimeEspecial: updated.nfse_regime_especial,
    optanteSimples: updated.nfse_optante_simples,
    ambiente: updated.nfse_ambiente,
    certificateLoaded: !!updated.nfse_certificado_base64,
  });
});

router.post("/certificate", (req, res) => {
  const uid = ownerId(req);
  const { certificateBase64, password } = req.body || {};
  if (!certificateBase64 || !password) {
    throw new ValidationError("Certificado e senha são obrigatórios");
  }
  if (typeof certificateBase64 !== "string" || certificateBase64.length > 50_000) {
    throw new ValidationError("Certificado inválido ou muito grande");
  }

  upsertTenantConfig(uid, {
    nfse_certificado_base64: encrypt(certificateBase64),
    nfse_certificado_senha: encrypt(password),
  });
  res.json({ success: true, message: "Certificado salvo com sucesso" });
});

router.delete("/certificate", (req, res) => {
  const uid = ownerId(req);
  upsertTenantConfig(uid, {
    nfse_certificado_base64: null,
    nfse_certificado_senha: null,
  });
  res.json({ success: true });
});

router.get("/invoices", (req, res) => {
  const uid = ownerId(req);
  res.json(listNfseInvoices(uid));
});

router.get("/invoices/:id", (req, res) => {
  const uid = ownerId(req);
  const invoice = getNfseInvoice(uid, req.params.id);
  if (!invoice) {
    res.status(404).json({ error: "NFS-e não encontrada" });
    return;
  }
  res.json(invoice);
});

router.post("/emitir", async (req, res) => {
  const uid = ownerId(req);
  const { saleId, clientId, descricaoServico, valorServicoCents, tomadorNome, tomadorDocumento, tomadorEmail } = req.body || {};

  const config = getTenantConfig(uid);
  if (!config || !isNfseConfigured(config)) {
    res.status(400).json({ error: "Configuração de NFS-e incompleta" });
    return;
  }

  let descricao = descricaoServico;
  let valor = valorServicoCents;
  let nome = tomadorNome;
  let documento = tomadorDocumento;
  let email = tomadorEmail;

  if (clientId) {
    const client = getClient(uid, clientId);
    if (client) {
      nome = nome || client.name;
      documento = documento || client.document;
      email = email || client.email;
    }
  }

  if (saleId) {
    const existing = getNfseInvoiceBySaleId(uid, saleId);
    if (existing && existing.status === "autorizada") {
      res.status(400).json({ error: "Já existe uma NFS-e autorizada para esta venda", invoiceId: existing.id });
      return;
    }

    const sale = getSale(uid, saleId);
    if (!sale) {
      res.status(404).json({ error: "Venda não encontrada" });
      return;
    }

    descricao = descricao || sale.item_name;
    valor = valor || sale.amount_cents;
    nome = nome || sale.client_name;
    documento = documento || sale.client_document;
    email = email || sale.client_email;
  }

  if (!descricao || !valor || !nome) {
    res.status(400).json({ error: "Descrição do serviço, valor e nome do tomador são obrigatórios" });
    return;
  }

  const invoice = createNfseInvoice(uid, {
    sale_id: saleId || null,
    valor_servico_cents: valor,
    descricao_servico: descricao,
    tomador_nome: nome,
    tomador_documento: documento || null,
    tomador_email: email || null,
  });

  updateNfseInvoice(uid, invoice.id, { status: "processando" });

  try {
    const competencia = new Date().toISOString().slice(0, 10);
    const result = await emitirNfse(config, {
      tomadorNome: nome,
      tomadorDocumento: documento || null,
      tomadorEmail: email || null,
      descricaoServico: descricao,
      valorServicoCents: valor,
      competencia,
    });

    if (result.success) {
      const updated = updateNfseInvoice(uid, invoice.id, {
        status: "autorizada",
        chave_acesso: result.chaveAcesso || null,
        numero_nfse: result.numeroNfse || null,
        codigo_verificacao: result.codigoVerificacao || null,
        dps_xml: result.dpsXml || null,
        nfse_xml: result.nfseXml || null,
        danfse_url: result.danfseUrl || null,
        emitida_em: new Date().toISOString(),
      });
      res.json({ success: true, invoice: updated });
    } else {
      const updated = updateNfseInvoice(uid, invoice.id, {
        status: "rejeitada",
        dps_xml: result.dpsXml || null,
        erro_mensagem: result.erro || null,
      });
      res.status(422).json({ success: false, error: result.erro, invoice: updated });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    updateNfseInvoice(uid, invoice.id, {
      status: "erro",
      erro_mensagem: msg,
    });
    res.status(500).json({ success: false, error: msg });
  }
});

router.post("/invoices/:id/consultar", async (req, res) => {
  const uid = ownerId(req);
  const invoice = getNfseInvoice(uid, req.params.id);
  if (!invoice) {
    res.status(404).json({ error: "NFS-e não encontrada" });
    return;
  }
  if (!invoice.chave_acesso) {
    res.status(400).json({ error: "NFS-e sem chave de acesso para consulta" });
    return;
  }

  const config = getTenantConfig(uid);
  if (!config) {
    res.status(400).json({ error: "Configuração não encontrada" });
    return;
  }

  const result = await consultarNfse(config, invoice.chave_acesso);
  if (result.success) {
    updateNfseInvoice(uid, invoice.id, {
      nfse_xml: result.nfseXml || null,
      status: result.status || "autorizada",
    });
    res.json({ success: true, status: result.status });
  } else {
    res.status(422).json({ success: false, error: result.erro });
  }
});

router.post("/invoices/:id/cancelar", async (req, res) => {
  const uid = ownerId(req);
  const invoice = getNfseInvoice(uid, req.params.id);
  if (!invoice) {
    res.status(404).json({ error: "NFS-e não encontrada" });
    return;
  }
  if (invoice.status !== "autorizada") {
    res.status(400).json({ error: "Só é possível cancelar NFS-e autorizada" });
    return;
  }
  if (!invoice.chave_acesso) {
    res.status(400).json({ error: "NFS-e sem chave de acesso" });
    return;
  }

  const motivo = req.body?.motivo || "Cancelamento solicitado pelo prestador";
  const config = getTenantConfig(uid);
  if (!config) {
    res.status(400).json({ error: "Configuração não encontrada" });
    return;
  }

  const result = await cancelarNfse(config, invoice.chave_acesso, motivo);
  if (result.success) {
    const updated = updateNfseInvoice(uid, invoice.id, {
      status: "cancelada",
      cancelada_em: new Date().toISOString(),
    });
    res.json({ success: true, invoice: updated });
  } else {
    res.status(422).json({ success: false, error: result.erro });
  }
});

router.get("/sale/:saleId", (req, res) => {
  const uid = ownerId(req);
  const invoice = getNfseInvoiceBySaleId(uid, req.params.saleId);
  res.json(invoice || null);
});

router.post("/reconcile", async (req, res) => {
  const uid = ownerId(req);
  const invoices = listNfseInvoices(uid).filter(
    (i) => i.status === "processando" && i.chave_acesso
  );
  let updated = 0;
  const errors: string[] = [];
  const config = getTenantConfig(uid);
  if (!config) {
    res.status(400).json({ error: "Configuração não encontrada" });
    return;
  }
  for (const inv of invoices) {
    try {
      const result = await consultarNfse(config, inv.chave_acesso!);
      if (result.success && result.status && result.status !== inv.status) {
        updateNfseInvoice(uid, inv.id, {
          status: result.status,
          nfse_xml: result.nfseXml || null,
        });
        updated++;
      }
    } catch (err) {
      errors.push(`${inv.id}: ${(err as Error).message}`);
    }
  }
  res.json({ checked: invoices.length, updated, errors });
});

export { router as nfseRouter };
