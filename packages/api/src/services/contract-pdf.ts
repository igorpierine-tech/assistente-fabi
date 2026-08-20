import PDFDocument from "pdfkit";
import type { Sale } from "./sales-db";

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência bancária",
  boleto: "Boleto bancário",
  outro: "Outro",
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatMethod(method: string | null, installments: number): string {
  if (!method) return "A combinar";
  const label = METHOD_LABELS[method] || method;
  if (installments > 1) return `${label} em ${installments}x`;
  return label;
}

interface ProviderInfo {
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
}

const DEFAULT_PROVIDER: ProviderInfo = {
  name: "Fabiana — Raízes e Riquezas",
  document: "",
  email: "",
  phone: "",
  address: "",
};

/**
 * Generate a contract PDF as a Buffer.
 * Provider info comes from env vars so it can be customized without editing code:
 *   CONTRACT_PROVIDER_NAME, CONTRACT_PROVIDER_DOCUMENT,
 *   CONTRACT_PROVIDER_EMAIL, CONTRACT_PROVIDER_PHONE, CONTRACT_PROVIDER_ADDRESS
 */
export async function generateContractPdf(sale: Sale): Promise<Buffer> {
  const provider: ProviderInfo = {
    name: process.env.CONTRACT_PROVIDER_NAME || DEFAULT_PROVIDER.name,
    document: process.env.CONTRACT_PROVIDER_DOCUMENT,
    email: process.env.CONTRACT_PROVIDER_EMAIL,
    phone: process.env.CONTRACT_PROVIDER_PHONE,
    address: process.env.CONTRACT_PROVIDER_ADDRESS,
  };

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        info: {
          Title: `Contrato — ${sale.client_name}`,
          Author: provider.name,
          Subject: sale.item_name,
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .fillColor("#1a2e18")
        .text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS", { align: "center" });

      doc.moveDown(0.3);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#6b6152")
        .text(provider.name, { align: "center" });

      doc.moveDown(1.5);

      // Parties
      doc.fillColor("#1a2e18").fontSize(11).font("Helvetica-Bold").text("CONTRATANTE");
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10).fillColor("#2c2c2c");
      doc.text(sale.client_name);
      if (sale.client_document) doc.text(`Documento: ${sale.client_document}`);
      if (sale.client_email) doc.text(`E-mail: ${sale.client_email}`);
      if (sale.client_phone) doc.text(`Telefone: ${sale.client_phone}`);

      doc.moveDown(0.8);
      doc.fillColor("#1a2e18").fontSize(11).font("Helvetica-Bold").text("CONTRATADA");
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10).fillColor("#2c2c2c").text(provider.name);
      if (provider.document) doc.text(`Documento: ${provider.document}`);
      if (provider.address) doc.text(`Endereço: ${provider.address}`);
      if (provider.email) doc.text(`E-mail: ${provider.email}`);
      if (provider.phone) doc.text(`Telefone: ${provider.phone}`);

      doc.moveDown(1.2);

      // Clauses
      doc.fillColor("#1a2e18").fontSize(11).font("Helvetica-Bold").text("CLÁUSULA 1ª — DO OBJETO");
      doc.moveDown(0.3);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#2c2c2c")
        .text(
          `O presente instrumento tem por objeto a prestação do serviço/produto ` +
            `denominado "${sale.item_name}", conforme especificações acordadas ` +
            `entre as partes.`,
          { align: "justify" }
        );

      doc.moveDown(0.8);
      doc.fillColor("#1a2e18").fontSize(11).font("Helvetica-Bold").text("CLÁUSULA 2ª — DO VALOR E FORMA DE PAGAMENTO");
      doc.moveDown(0.3);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#2c2c2c")
        .text(
          `Pela prestação do serviço/produto objeto deste contrato, o CONTRATANTE ` +
            `pagará à CONTRATADA o valor total de ${formatBRL(sale.amount_cents)} ` +
            `(${valueInWords(sale.amount_cents)}), a ser quitado via ` +
            `${formatMethod(sale.payment_method, sale.installments)}.`,
          { align: "justify" }
        );

      doc.moveDown(0.8);
      doc.fillColor("#1a2e18").fontSize(11).font("Helvetica-Bold").text("CLÁUSULA 3ª — DAS OBRIGAÇÕES DAS PARTES");
      doc.moveDown(0.3);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#2c2c2c")
        .text(
          `A CONTRATADA compromete-se a executar o serviço/entregar o produto com ` +
            `zelo, ética e profissionalismo. O CONTRATANTE compromete-se a efetuar ` +
            `o pagamento na forma e nos prazos acordados, bem como a fornecer as ` +
            `informações necessárias para a boa execução deste contrato.`,
          { align: "justify" }
        );

      doc.moveDown(0.8);
      doc.fillColor("#1a2e18").fontSize(11).font("Helvetica-Bold").text("CLÁUSULA 4ª — DA CONFIDENCIALIDADE");
      doc.moveDown(0.3);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#2c2c2c")
        .text(
          `Ambas as partes comprometem-se a manter sigilo absoluto sobre todas as ` +
            `informações pessoais, profissionais e sensíveis compartilhadas durante ` +
            `a execução deste contrato, respeitando integralmente a Lei Geral de ` +
            `Proteção de Dados (Lei nº 13.709/2018).`,
          { align: "justify" }
        );

      if (sale.notes) {
        doc.moveDown(0.8);
        doc.fillColor("#1a2e18").fontSize(11).font("Helvetica-Bold").text("OBSERVAÇÕES");
        doc.moveDown(0.3);
        doc.font("Helvetica").fontSize(10).fillColor("#2c2c2c").text(sale.notes, {
          align: "justify",
        });
      }

      doc.moveDown(0.8);
      doc.fillColor("#1a2e18").fontSize(11).font("Helvetica-Bold").text("CLÁUSULA 5ª — DO FORO");
      doc.moveDown(0.3);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#2c2c2c")
        .text(
          `As partes elegem o foro da comarca do domicílio do CONTRATANTE para ` +
            `dirimir quaisquer dúvidas oriundas deste contrato, com renúncia expressa ` +
            `a qualquer outro, por mais privilegiado que seja.`,
          { align: "justify" }
        );

      doc.moveDown(2);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#2c2c2c")
        .text(
          `E por estarem assim justos e contratados, assinam o presente instrumento ` +
            `em duas vias de igual teor e forma.`,
          { align: "justify" }
        );

      doc.moveDown(1);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#2c2c2c")
        .text(formatDateLong(sale.sale_date), { align: "right" });

      doc.moveDown(3);

      // Signature lines
      const pageWidth = doc.page.width - 120;
      const lineWidth = 200;
      const y = doc.y;

      // Left signature (CONTRATANTE)
      doc
        .moveTo(60, y)
        .lineTo(60 + lineWidth, y)
        .strokeColor("#2c2c2c")
        .lineWidth(0.5)
        .stroke();
      doc
        .fontSize(9)
        .fillColor("#2c2c2c")
        .text("CONTRATANTE", 60, y + 6, { width: lineWidth, align: "center" });
      doc.text(sale.client_name, 60, y + 20, {
        width: lineWidth,
        align: "center",
      });

      // Right signature (CONTRATADA)
      const rightX = 60 + pageWidth - lineWidth;
      doc
        .moveTo(rightX, y)
        .lineTo(rightX + lineWidth, y)
        .strokeColor("#2c2c2c")
        .lineWidth(0.5)
        .stroke();
      doc
        .fontSize(9)
        .fillColor("#2c2c2c")
        .text("CONTRATADA", rightX, y + 6, {
          width: lineWidth,
          align: "center",
        });
      doc.text(provider.name, rightX, y + 20, {
        width: lineWidth,
        align: "center",
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Simple integer-to-words for BRL (approximate; falls back to numeric string).
function valueInWords(cents: number): string {
  const reais = Math.floor(cents / 100);
  const cents_ = cents % 100;
  const parts = [`${numberToWords(reais)} ${reais === 1 ? "real" : "reais"}`];
  if (cents_) {
    parts.push(`e ${numberToWords(cents_)} ${cents_ === 1 ? "centavo" : "centavos"}`);
  }
  return parts.join(" ");
}

const UNITS = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function numberToWords(n: number): string {
  if (n < 0) return `menos ${numberToWords(-n)}`;
  if (n < 20) return UNITS[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    return u ? `${TENS[t]} e ${UNITS[u]}` : TENS[t];
  }
  if (n === 100) return "cem";
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return rest ? `${HUNDREDS[h]} e ${numberToWords(rest)}` : HUNDREDS[h];
  }
  if (n < 1_000_000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const t = thousands === 1 ? "mil" : `${numberToWords(thousands)} mil`;
    return rest ? `${t} ${rest < 100 ? "e " : ""}${numberToWords(rest)}` : t;
  }
  return String(n);
}
