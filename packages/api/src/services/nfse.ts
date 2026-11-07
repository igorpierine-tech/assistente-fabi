import { randomUUID } from "node:crypto";
import type { TenantConfigRow } from "./database";
import { decrypt, isEncrypted } from "./crypto";

const SEFIN_URLS = {
  producao: "https://sefin.nfse.gov.br/SefinNacional",
  homologacao: "https://sefin.producaorestrita.nfse.gov.br/SefinNacional",
} as const;

export interface DpsData {
  prestadorCnpj: string;
  prestadorInscricaoMunicipal: string;
  tomadorNome: string;
  tomadorDocumento: string | null;
  tomadorEmail: string | null;
  descricaoServico: string;
  valorServicoCents: number;
  codigoMunicipio: string;
  codigoTributacaoNacional: string;
  itemListaServico: string;
  aliquotaIss: number;
  optanteSimples: number;
  regimeEspecial: number | null;
  competencia: string;
}

function getCertPassword(config: TenantConfigRow): string {
  const raw = config.nfse_certificado_senha;
  if (!raw) return "";
  return isEncrypted(raw) ? decrypt(raw) : raw;
}

export interface EmissaoResult {
  success: boolean;
  chaveAcesso?: string;
  numeroNfse?: string;
  codigoVerificacao?: string;
  nfseXml?: string;
  danfseUrl?: string;
  dpsXml?: string;
  erro?: string;
}

export function isNfseConfigured(config: TenantConfigRow): boolean {
  return !!(
    config.cnpj &&
    config.nfse_codigo_municipio &&
    config.nfse_codigo_tributacao_nacional &&
    config.nfse_item_lista_servico &&
    config.nfse_aliquota_iss != null
  );
}

function formatCnpj(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, "");
}

function formatCpfCnpj(doc: string | null): string {
  if (!doc) return "";
  return doc.replace(/[^\d]/g, "");
}

function buildDpsXml(data: DpsData, dpsId: string): string {
  const cnpj = formatCnpj(data.prestadorCnpj);
  const tomadorDoc = formatCpfCnpj(data.tomadorDocumento);
  const valorServico = (data.valorServicoCents / 100).toFixed(2);
  const aliquota = data.aliquotaIss.toFixed(4);
  const valorIss = ((data.valorServicoCents / 100) * data.aliquotaIss).toFixed(2);
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "-03:00");

  const tomadorTag = tomadorDoc.length === 11 ? "CPF" : "CNPJ";

  let tomadorXml = `
      <toma>
        <xNome>${escapeXml(data.tomadorNome)}</xNome>`;
  if (tomadorDoc) {
    tomadorXml += `
        <${tomadorTag}>${tomadorDoc}</${tomadorTag}>`;
  }
  if (data.tomadorEmail) {
    tomadorXml += `
        <email>${escapeXml(data.tomadorEmail)}</email>`;
  }
  tomadorXml += `
      </toma>`;

  const opSimpNac = data.optanteSimples === 2 ? 2 : data.optanteSimples === 3 ? 3 : 1;
  const regEspTrib = data.regimeEspecial ? `<regEspTrib>${data.regimeEspecial}</regEspTrib>` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infDPS Id="${dpsId}">
    <tpAmb>${data.optanteSimples === 1 ? "1" : "1"}</tpAmb>
    <dhEmi>${now}</dhEmi>
    <verAplic>AssistenteFabi1.0</verAplic>
    <dCompet>${data.competencia}</dCompet>
    <nDPS>${dpsId.slice(-15)}</nDPS>
    <tpEmit>1</tpEmit>
    <cLocEmi>${data.codigoMunicipio}</cLocEmi>
    <opSimpNac>${opSimpNac}</opSimpNac>
    ${regEspTrib}
    <prest>
      <CNPJ>${cnpj}</CNPJ>
      <IM>${escapeXml(data.prestadorInscricaoMunicipal)}</IM>
    </prest>
    ${tomadorXml}
    <serv>
      <cServ>
        <cTribNac>${data.codigoTributacaoNacional}</cTribNac>
        <cNBS>1.0000</cNBS>
        <xDescServ>${escapeXml(data.descricaoServico)}</xDescServ>
      </cServ>
      <cLocPrestacao>${data.codigoMunicipio}</cLocPrestacao>
      <cPaisPrestacao>1058</cPaisPrestacao>
    </serv>
    <valores>
      <vServPrest>
        <vServ>${valorServico}</vServ>
      </vServPrest>
      <trib>
        <tribMun>
          <cLocIncid>${data.codigoMunicipio}</cLocIncid>
          <cTribMun>${data.itemListaServico}</cTribMun>
          <pAliq>${aliquota}</pAliq>
          <tpRetISSQN>1</tpRetISSQN>
        </tribMun>
        <totTrib>
          <indTotTrib>0</indTotTrib>
          <pTotTribSN>0.0000</pTotTribSN>
        </totTrib>
      </trib>
    </valores>
  </infDPS>
</DPS>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function emitirNfse(
  config: TenantConfigRow,
  data: Omit<DpsData, "prestadorCnpj" | "prestadorInscricaoMunicipal" | "codigoMunicipio" | "codigoTributacaoNacional" | "itemListaServico" | "aliquotaIss" | "optanteSimples" | "regimeEspecial">
): Promise<EmissaoResult> {
  if (!isNfseConfigured(config)) {
    return { success: false, erro: "Configuração de NFS-e incompleta. Preencha os dados fiscais nas configurações." };
  }

  const ambiente = (config.nfse_ambiente || "homologacao") as keyof typeof SEFIN_URLS;
  const baseUrl = SEFIN_URLS[ambiente] || SEFIN_URLS.homologacao;
  const dpsId = `DPS${randomUUID().replace(/-/g, "").slice(0, 20)}`;

  const dpsData: DpsData = {
    ...data,
    prestadorCnpj: config.cnpj!,
    prestadorInscricaoMunicipal: config.inscricao_municipal || "",
    codigoMunicipio: config.nfse_codigo_municipio!,
    codigoTributacaoNacional: config.nfse_codigo_tributacao_nacional!,
    itemListaServico: config.nfse_item_lista_servico!,
    aliquotaIss: config.nfse_aliquota_iss!,
    optanteSimples: config.nfse_optante_simples ?? 1,
    regimeEspecial: config.nfse_regime_especial,
  };

  const dpsXml = buildDpsXml(dpsData, dpsId);

  if (!config.nfse_certificado_base64 || !config.nfse_certificado_senha) {
    return {
      success: false,
      dpsXml,
      erro: "Certificado digital A1 não configurado. Faça upload do certificado .pfx nas configurações de NFS-e.",
    };
  }

  try {
    const pfxBuffer = Buffer.from(config.nfse_certificado_base64, "base64");

    const xmlCompressed = Buffer.from(dpsXml, "utf-8");
    const xmlBase64 = xmlCompressed.toString("base64");

    const { Agent } = await import("node:https");
    const agent = new Agent({
      pfx: pfxBuffer,
      passphrase: getCertPassword(config),
      rejectUnauthorized: true,
    });

    const response = await fetch(`${baseUrl}/nfse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ dpsXmlGZipB64: xmlBase64 }),
      // @ts-expect-error Node.js fetch supports dispatcher/agent
      dispatcher: agent,
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errorMsg = `Erro HTTP ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMsg = errorData.mensagem || errorData.message || errorData.erro || responseText.slice(0, 500);
      } catch {
        errorMsg = responseText.slice(0, 500);
      }
      return { success: false, dpsXml, erro: errorMsg };
    }

    const result = JSON.parse(responseText);
    const nfseXml = result.nfseXmlGZipB64
      ? Buffer.from(result.nfseXmlGZipB64, "base64").toString("utf-8")
      : null;

    return {
      success: true,
      dpsXml,
      nfseXml: nfseXml ?? undefined,
      chaveAcesso: result.chNFSe || result.chaveAcesso || extractFromXml(nfseXml, "chNFSe"),
      numeroNfse: result.nNFSe || result.numero || extractFromXml(nfseXml, "nNFSe"),
      codigoVerificacao: result.cVerif || extractFromXml(nfseXml, "cVerif"),
      danfseUrl: result.urlDANFSe || undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, dpsXml, erro: `Erro de comunicação com o Portal Nacional: ${message}` };
  }
}

export async function consultarNfse(
  config: TenantConfigRow,
  chaveAcesso: string
): Promise<{ success: boolean; nfseXml?: string; status?: string; erro?: string }> {
  if (!config.nfse_certificado_base64 || !config.nfse_certificado_senha) {
    return { success: false, erro: "Certificado digital não configurado" };
  }

  const ambiente = (config.nfse_ambiente || "homologacao") as keyof typeof SEFIN_URLS;
  const baseUrl = SEFIN_URLS[ambiente] || SEFIN_URLS.homologacao;

  try {
    const pfxBuffer = Buffer.from(config.nfse_certificado_base64, "base64");
    const { Agent } = await import("node:https");
    const agent = new Agent({
      pfx: pfxBuffer,
      passphrase: getCertPassword(config),
      rejectUnauthorized: true,
    });

    const response = await fetch(`${baseUrl}/nfse/${chaveAcesso}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      // @ts-expect-error Node.js fetch supports dispatcher/agent
      dispatcher: agent,
    });

    if (!response.ok) {
      return { success: false, erro: `Erro HTTP ${response.status}` };
    }

    const result = await response.json() as Record<string, unknown>;
    const nfseXml = typeof result.nfseXmlGZipB64 === "string"
      ? Buffer.from(result.nfseXmlGZipB64, "base64").toString("utf-8")
      : undefined;

    return {
      success: true,
      nfseXml,
      status: typeof result.sit === "string" ? result.sit : "autorizada",
    };
  } catch (err) {
    return { success: false, erro: err instanceof Error ? err.message : String(err) };
  }
}

export async function cancelarNfse(
  config: TenantConfigRow,
  chaveAcesso: string,
  motivo: string
): Promise<{ success: boolean; erro?: string }> {
  if (!config.nfse_certificado_base64 || !config.nfse_certificado_senha) {
    return { success: false, erro: "Certificado digital não configurado" };
  }

  const ambiente = (config.nfse_ambiente || "homologacao") as keyof typeof SEFIN_URLS;
  const baseUrl = SEFIN_URLS[ambiente] || SEFIN_URLS.homologacao;

  const eventoXml = `<?xml version="1.0" encoding="UTF-8"?>
<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infPedReg>
    <tpEvento>e101101</tpEvento>
    <nSeqEvento>1</nSeqEvento>
    <dhEvento>${new Date().toISOString().replace(/\.\d{3}Z$/, "-03:00")}</dhEvento>
    <detEvento>
      <xMotivo>${escapeXml(motivo)}</xMotivo>
    </detEvento>
  </infPedReg>
</pedRegEvento>`;

  try {
    const pfxBuffer = Buffer.from(config.nfse_certificado_base64, "base64");
    const { Agent } = await import("node:https");
    const agent = new Agent({
      pfx: pfxBuffer,
      passphrase: getCertPassword(config),
      rejectUnauthorized: true,
    });

    const xmlBase64 = Buffer.from(eventoXml, "utf-8").toString("base64");

    const response = await fetch(`${baseUrl}/nfse/${chaveAcesso}/eventos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ pedRegEventoXmlGZipB64: xmlBase64 }),
      // @ts-expect-error Node.js fetch supports dispatcher/agent
      dispatcher: agent,
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, erro: `Erro HTTP ${response.status}: ${text.slice(0, 300)}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, erro: err instanceof Error ? err.message : String(err) };
  }
}

function extractFromXml(xml: string | null, tag: string): string | undefined {
  if (!xml) return undefined;
  const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
  return match?.[1];
}
