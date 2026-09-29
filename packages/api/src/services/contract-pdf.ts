import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import { PDFDocument as PDFLibDocument } from "pdf-lib";
import type { Sale } from "./sales-db";
import type { ContractSnapshot } from "./contract-composer";

const TOP_MARGIN = 155;
const BOTTOM_MARGIN = 200;
const SIDE_MARGIN = 65;
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const CONTENT_WIDTH = A4_WIDTH - SIDE_MARGIN * 2;
const MAX_CONTENT_Y = A4_HEIGHT - BOTTOM_MARGIN;

const GREEN = "#1a2e18";
const DARK = "#2c2c2c";
const MUTED = "#6b6152";
const GOLD = "#b8873a";

function getAssetPath(filename: string): string {
  const bundled = join(__dirname, "..", "assets", filename);
  if (existsSync(bundled)) return bundled;
  return join(__dirname, "..", "..", "assets", filename);
}

async function overlayOnLetterhead(contentPdf: Buffer): Promise<Buffer> {
  let letterheadBytes: Buffer;
  try {
    letterheadBytes = readFileSync(getAssetPath("papel-timbrado.pdf"));
  } catch {
    return contentPdf;
  }

  const letterheadDoc = await PDFLibDocument.load(letterheadBytes);
  const contentDoc = await PDFLibDocument.load(contentPdf);
  const resultDoc = await PDFLibDocument.create();

  const [letterheadEmbed] = await resultDoc.embedPages(letterheadDoc.getPages());
  const contentPages = contentDoc.getPages();

  for (let i = 0; i < contentPages.length; i++) {
    const [contentEmbed] = await resultDoc.embedPages([contentPages[i]]);
    const page = resultDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    page.drawPage(letterheadEmbed, { x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT });
    page.drawPage(contentEmbed, { x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT });
  }

  return Buffer.from(await resultDoc.save());
}

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
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

function formatMethod(method: string | null, installments: number): string {
  if (!method) return "A combinar";
  const label = METHOD_LABELS[method] || method;
  if (installments > 1) return `${label} em ${installments}x`;
  return label;
}

function needsPageBreak(doc: PDFKit.PDFDocument, spaceNeeded: number): void {
  if (doc.y > MAX_CONTENT_Y - spaceNeeded) doc.addPage();
}

interface ProviderInfo {
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export async function generateContractPdf(sale: Sale): Promise<Buffer> {
  const provider: ProviderInfo = {
    name: process.env.CONTRACT_PROVIDER_NAME || "Prestador de Serviços",
    document: process.env.CONTRACT_PROVIDER_DOCUMENT,
    email: process.env.CONTRACT_PROVIDER_EMAIL,
    phone: process.env.CONTRACT_PROVIDER_PHONE,
    address: process.env.CONTRACT_PROVIDER_ADDRESS,
  };

  const contentPdf = await new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: TOP_MARGIN, bottom: BOTTOM_MARGIN, left: SIDE_MARGIN, right: SIDE_MARGIN },
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

      // --- Título ---
      doc.font("Helvetica-Bold").fontSize(14).fillColor(GREEN)
        .text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS", { align: "center" });
      doc.moveDown(0.5);
      doc.moveTo(SIDE_MARGIN, doc.y).lineTo(SIDE_MARGIN + CONTENT_WIDTH, doc.y).strokeColor(GOLD).lineWidth(0.5).stroke();
      doc.moveDown(0.7);

      // --- Partes ---
      const contratanteDoc = sale.client_document ? `, ${sale.client_document}` : "";
      const contratanteEmail = sale.client_email ? `, e-mail ${sale.client_email}` : "";
      const contratanteTel = sale.client_phone ? `, telefone ${sale.client_phone}` : "";
      const providerDocStr = provider.document ? `, ${provider.document}` : "";
      const providerAddr = provider.address ? `, com sede em ${provider.address}` : "";
      const providerEmailStr = provider.email ? `, e-mail ${provider.email}` : "";

      doc.font("Helvetica").fontSize(9).fillColor(DARK)
        .text(
          `Pelo presente instrumento particular, de um lado, ${sale.client_name.toUpperCase()}${contratanteDoc}${contratanteEmail}${contratanteTel}, doravante denominado(a) CONTRATANTE, e de outro lado, ${provider.name.toUpperCase()}${providerDocStr}${providerAddr}${providerEmailStr}, doravante denominada CONTRATADA, celebram o presente contrato de prestação de serviços, que se regerá pelas cláusulas e condições a seguir:`,
          { align: "justify", lineGap: 2 }
        );

      doc.moveDown(0.6);
      doc.moveTo(SIDE_MARGIN, doc.y).lineTo(SIDE_MARGIN + CONTENT_WIDTH, doc.y).strokeColor(GOLD).lineWidth(0.3).stroke();
      doc.moveDown(0.6);

      // --- Cláusulas ---
      const clauses = [
        { title: "Cláusula 1ª — Do Objeto", text: `O presente instrumento tem por objeto a prestação do serviço denominado "${sale.item_name}", conforme especificações acordadas entre as partes.` },
        { title: "Cláusula 2ª — Do Valor e Forma de Pagamento", text: `Pela prestação dos serviços objeto deste contrato, o CONTRATANTE pagará à CONTRATADA o valor total de ${formatBRL(sale.amount_cents)} (${valueInWords(sale.amount_cents)}), a ser quitado via ${formatMethod(sale.payment_method, sale.installments)}. O não pagamento nas datas acordadas acarretará a incidência de multa de 2% (dois por cento) sobre o valor devido, acrescida de juros de mora de 1% (um por cento) ao mês.` },
        { title: "Cláusula 3ª — Das Obrigações do CONTRATANTE", text: "Compete ao CONTRATANTE efetuar os pagamentos na forma e prazos acordados, fornecer as informações necessárias à boa execução dos serviços com veracidade e tempestividade, observar os horários e compromissos da agenda acordada, e manter conduta respeitosa e colaborativa." },
        { title: "Cláusula 4ª — Das Obrigações da CONTRATADA", text: "Compete à CONTRATADA executar os serviços contratados com zelo, ética, diligência e profissionalismo, disponibilizar profissional qualificado e compatível com o escopo contratado, cumprir o cronograma e os prazos acordados, e proteger as informações recebidas do CONTRATANTE." },
        { title: "Cláusula 5ª — Da Vigência e Rescisão", text: "Este contrato entra em vigor na data de sua assinatura e permanece vigente até a conclusão dos serviços contratados. A rescisão poderá ocorrer por mútuo acordo, por inadimplemento mediante notificação prévia de 15 dias, ou por justa causa nos termos da legislação vigente." },
        { title: "Cláusula 6ª — Da Confidencialidade", text: "As partes comprometem-se a manter sigilo absoluto sobre todas as informações pessoais, profissionais e sensíveis compartilhadas durante a vigência deste contrato e por prazo de 2 (dois) anos após seu encerramento, respeitando integralmente a Lei Geral de Proteção de Dados (Lei nº 13.709/2018)." },
        { title: "Cláusula 7ª — Da LGPD", text: "Os dados pessoais coletados no âmbito deste contrato serão tratados exclusivamente para as finalidades de execução contratual e cumprimento de obrigação legal, nos termos da Lei nº 13.709/2018. O CONTRATANTE poderá solicitar acesso, correção ou eliminação de seus dados pessoais a qualquer momento." },
        { title: "Cláusula 8ª — Do Direito de Imagem e Propriedade Intelectual", text: "Esta contratação não autoriza a utilização do nome, imagem ou voz do CONTRATANTE para fins publicitários. Os materiais e metodologias da CONTRATADA são de sua propriedade intelectual, sendo concedida ao CONTRATANTE autorização de uso pessoal, vedada reprodução ou revenda." },
        { title: "Cláusula 9ª — Da Multa", text: "O descumprimento de qualquer cláusula deste contrato sujeitará a parte infratora ao pagamento de multa compensatória equivalente a 20% (vinte por cento) do valor total do contrato, sem prejuízo da obrigação de reparar integralmente os danos causados." },
        { title: "Cláusula 10ª — Das Condições Gerais", text: "Este contrato representa o acordo integral entre as partes. Alterações somente terão validade se realizadas por escrito e assinadas por ambas as partes. As partes admitem a utilização de meios eletrônicos para assinatura e comunicação, conferindo-lhes plena validade jurídica." },
        { title: "Cláusula 11ª — Do Foro", text: "As partes elegem o foro da comarca do domicílio do CONTRATANTE para dirimir quaisquer dúvidas oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja, ressalvado o direito do consumidor de optar pelo foro de seu domicílio." },
      ];

      for (const clause of clauses) {
        needsPageBreak(doc, 50);
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(GREEN).text(clause.title);
        doc.moveDown(0.2);
        doc.font("Helvetica").fontSize(9).fillColor(DARK).text(clause.text, { align: "justify", lineGap: 2 });
        doc.moveDown(0.5);
      }

      if (sale.notes) {
        needsPageBreak(doc, 50);
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(GREEN).text("Observações");
        doc.moveDown(0.2);
        doc.font("Helvetica").fontSize(9).fillColor(DARK).text(sale.notes, { align: "justify", lineGap: 2 });
        doc.moveDown(0.5);
      }

      // --- Encerramento e Assinaturas ---
      needsPageBreak(doc, 160);

      doc.moveDown(0.3);
      doc.moveTo(SIDE_MARGIN, doc.y).lineTo(SIDE_MARGIN + CONTENT_WIDTH, doc.y).strokeColor(GOLD).lineWidth(0.3).stroke();
      doc.moveDown(0.7);

      doc.font("Helvetica").fontSize(9).fillColor(DARK)
        .text("E por estarem assim justos e contratados, assinam o presente instrumento em duas vias de igual teor e forma, na presença das testemunhas abaixo.", { align: "justify" });

      doc.moveDown(0.6);
      doc.font("Helvetica").fontSize(9).fillColor(DARK).text(formatDateLong(sale.sale_date), { align: "right" });

      doc.moveDown(2.5);
      const sigY = doc.y;
      const lineW = 180;

      doc.moveTo(SIDE_MARGIN, sigY).lineTo(SIDE_MARGIN + lineW, sigY).strokeColor(DARK).lineWidth(0.5).stroke();
      doc.fontSize(8).fillColor(DARK).text("CONTRATANTE", SIDE_MARGIN, sigY + 5, { width: lineW, align: "center" });
      doc.text(sale.client_name, SIDE_MARGIN, sigY + 17, { width: lineW, align: "center" });

      const rX = SIDE_MARGIN + CONTENT_WIDTH - lineW;
      doc.moveTo(rX, sigY).lineTo(rX + lineW, sigY).strokeColor(DARK).lineWidth(0.5).stroke();
      doc.fontSize(8).fillColor(DARK).text("CONTRATADA", rX, sigY + 5, { width: lineW, align: "center" });
      doc.text(provider.name, rX, sigY + 17, { width: lineW, align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });

  return overlayOnLetterhead(contentPdf);
}

export async function generateContractPdfFromSnapshot(snapshot: ContractSnapshot): Promise<Buffer> {
  const contentPdf = await new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: TOP_MARGIN, bottom: BOTTOM_MARGIN, left: SIDE_MARGIN, right: SIDE_MARGIN },
        info: {
          Title: `Contrato ${snapshot.contract_number} — ${snapshot.contratante.nome}`,
          Author: snapshot.contratada.razao_social,
          Subject: snapshot.service_name,
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // --- Título ---
      const isAdesao = snapshot.service_code === "mentoria_adesao";
      const tituloContrato = isAdesao ? "CONTRATO DE ADESÃO" : "CONTRATO DE PRESTAÇÃO DE SERVIÇOS";
      doc.font("Helvetica-Bold").fontSize(14).fillColor(GREEN)
        .text(tituloContrato, { align: "center" });
      doc.moveDown(0.15);
      doc.font("Helvetica").fontSize(9).fillColor(MUTED)
        .text(`Nº ${snapshot.contract_number}`, { align: "center" });
      doc.moveDown(0.4);
      doc.moveTo(SIDE_MARGIN, doc.y).lineTo(SIDE_MARGIN + CONTENT_WIDTH, doc.y).strokeColor(GOLD).lineWidth(0.5).stroke();
      doc.moveDown(0.6);

      // --- Partes ---
      doc.font("Helvetica").fontSize(9).fillColor(DARK);

      const contratanteDoc = snapshot.contratante.tipo_pessoa === "PJ"
        ? (snapshot.contratante.documento ? `inscrita no CNPJ sob nº ${snapshot.contratante.documento}` : "")
        : (snapshot.contratante.documento ? `inscrito(a) no CPF sob nº ${snapshot.contratante.documento}` : "");
      const contratanteIE = snapshot.contratante.tipo_pessoa === "PJ" && snapshot.contratante.inscricao_estadual
        ? `, Inscrição Estadual nº ${snapshot.contratante.inscricao_estadual}` : "";
      const contratanteAddr = snapshot.contratante.endereco
        ? `, com endereço em ${snapshot.contratante.endereco}` : "";
      const contratanteEmail = snapshot.contratante.email
        ? `, e-mail ${snapshot.contratante.email}` : "";
      const contratanteTel = snapshot.contratante.telefone
        ? `, telefone ${snapshot.contratante.telefone}` : "";

      const contratadaDoc = snapshot.contratada.cnpj
        ? `inscrita no CNPJ sob nº ${snapshot.contratada.cnpj}` : "";
      const contratadaAddr = snapshot.contratada.endereco
        ? `, com sede em ${snapshot.contratada.endereco}` : "";
      const contratadaRep = snapshot.contratada.representante_nome
        ? `, neste ato representada por ${snapshot.contratada.representante_nome}${snapshot.contratada.representante_cargo ? `, ${snapshot.contratada.representante_cargo}` : ""}`
        : "";

      const partiesParagraph =
        `Pelo presente instrumento particular, de um lado, ` +
        `${snapshot.contratante.nome.toUpperCase()}` +
        (contratanteDoc ? `, ${contratanteDoc}` : "") +
        contratanteIE +
        contratanteAddr + contratanteEmail + contratanteTel +
        `, doravante denominado(a) CONTRATANTE, e de outro lado, ` +
        `${snapshot.contratada.razao_social.toUpperCase()}` +
        (snapshot.contratada.nome_fantasia !== snapshot.contratada.razao_social
          ? `, nome fantasia ${snapshot.contratada.nome_fantasia}` : "") +
        (contratadaDoc ? `, ${contratadaDoc}` : "") +
        contratadaAddr +
        (snapshot.contratada.email ? `, e-mail ${snapshot.contratada.email}` : "") +
        contratadaRep +
        `, doravante denominada CONTRATADA, celebram o presente contrato de prestação de serviços, que se regerá pelas cláusulas e condições a seguir:`;

      doc.text(partiesParagraph, { align: "justify", lineGap: 2 });

      doc.moveDown(0.5);
      doc.moveTo(SIDE_MARGIN, doc.y).lineTo(SIDE_MARGIN + CONTENT_WIDTH, doc.y).strokeColor(GOLD).lineWidth(0.3).stroke();
      doc.moveDown(0.5);

      // --- Cláusulas base ---
      for (const clausula of snapshot.clausulas_base) {
        needsPageBreak(doc, 50);
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(GREEN).text(clausula.titulo);
        doc.moveDown(0.2);
        doc.font("Helvetica").fontSize(9).fillColor(DARK).text(clausula.texto, { align: "justify", lineGap: 2 });
        doc.moveDown(0.5);
      }

      // --- Módulo específico ---
      if (snapshot.modulo_especifico.length > 0) {
        if (snapshot.clausulas_base.length > 0) {
          doc.moveTo(SIDE_MARGIN, doc.y).lineTo(SIDE_MARGIN + CONTENT_WIDTH, doc.y).strokeColor(GOLD).lineWidth(0.3).stroke();
          doc.moveDown(0.5);
        }

        for (const modulo of snapshot.modulo_especifico) {
          needsPageBreak(doc, 50);
          doc.font("Helvetica-Bold").fontSize(9.5).fillColor(GREEN).text(modulo.titulo);
          doc.moveDown(0.2);
          doc.font("Helvetica").fontSize(9).fillColor(DARK).text(modulo.texto, { align: "justify", lineGap: 2 });
          doc.moveDown(0.5);
        }
      }

      // --- Encerramento e assinaturas ---
      needsPageBreak(doc, 180);

      doc.moveDown(0.3);
      doc.moveTo(SIDE_MARGIN, doc.y).lineTo(SIDE_MARGIN + CONTENT_WIDTH, doc.y).strokeColor(GOLD).lineWidth(0.3).stroke();
      doc.moveDown(0.7);

      doc.font("Helvetica").fontSize(9).fillColor(DARK)
        .text("E por estarem assim justos e contratados, assinam o presente instrumento em duas vias de igual teor e forma, na presença das testemunhas abaixo.", { align: "justify" });

      doc.moveDown(0.6);
      doc.font("Helvetica").fontSize(9).fillColor(DARK)
        .text(snapshot.quadro_resumo.data_contrato, { align: "right" });

      doc.moveDown(2.5);
      const sigY = doc.y;
      const lineW = 180;

      doc.moveTo(SIDE_MARGIN, sigY).lineTo(SIDE_MARGIN + lineW, sigY).strokeColor(DARK).lineWidth(0.5).stroke();
      doc.fontSize(8).fillColor(DARK).text("CONTRATANTE", SIDE_MARGIN, sigY + 5, { width: lineW, align: "center" });
      doc.text(snapshot.contratante.nome, SIDE_MARGIN, sigY + 17, { width: lineW, align: "center" });
      if (snapshot.contratante.documento) {
        doc.text(snapshot.contratante.documento, SIDE_MARGIN, sigY + 29, { width: lineW, align: "center" });
      }

      const rX = SIDE_MARGIN + CONTENT_WIDTH - lineW;
      doc.moveTo(rX, sigY).lineTo(rX + lineW, sigY).strokeColor(DARK).lineWidth(0.5).stroke();
      doc.fontSize(8).fillColor(DARK).text("CONTRATADA", rX, sigY + 5, { width: lineW, align: "center" });
      doc.text(snapshot.contratada.razao_social, rX, sigY + 17, { width: lineW, align: "center" });
      if (snapshot.contratada.cnpj) {
        doc.text(snapshot.contratada.cnpj, rX, sigY + 29, { width: lineW, align: "center" });
      }

      // --- Testemunhas ---
      if (doc.y < MAX_CONTENT_Y - 50) {
        doc.moveDown(2.5);
        doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("Testemunhas:", SIDE_MARGIN);
        doc.moveDown(1.5);
        const witLineY = doc.y;
        doc.moveTo(SIDE_MARGIN, witLineY).lineTo(SIDE_MARGIN + lineW, witLineY).strokeColor(MUTED).lineWidth(0.3).stroke();
        doc.fontSize(7).fillColor(MUTED).text("Nome / CPF", SIDE_MARGIN, witLineY + 4, { width: lineW, align: "center" });

        doc.moveTo(rX, witLineY).lineTo(rX + lineW, witLineY).strokeColor(MUTED).lineWidth(0.3).stroke();
        doc.fontSize(7).fillColor(MUTED).text("Nome / CPF", rX, witLineY + 4, { width: lineW, align: "center" });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });

  return overlayOnLetterhead(contentPdf);
}

function valueInWords(cents: number): string {
  const reais = Math.floor(cents / 100);
  const c = cents % 100;
  const parts = [`${numberToWords(reais)} ${reais === 1 ? "real" : "reais"}`];
  if (c) parts.push(`e ${numberToWords(c)} ${c === 1 ? "centavo" : "centavos"}`);
  return parts.join(" ");
}

const UNITS = [
  "zero","um","dois","três","quatro","cinco","seis","sete","oito","nove",
  "dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove",
];
const TENS = ["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
const HUNDREDS = ["","cento","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];

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
