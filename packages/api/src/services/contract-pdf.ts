import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import type { Sale } from "./sales-db";
import type { ContractSnapshot } from "./contract-composer";

function getLogoPath(): string {
  // esbuild bundles to dist/server.js → __dirname = dist/
  const bundled = join(__dirname, "..", "assets", "logo-raizes.png");
  if (existsSync(bundled)) return bundled;
  // tsc compiles to dist/services/ → __dirname = dist/services/
  return join(__dirname, "..", "..", "assets", "logo-raizes.png");
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

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 55, right: 55 },
        bufferPages: true,
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

      const green = "#1a2e18";
      const dark = "#2c2c2c";
      const muted = "#6b6152";
      const gold = "#b8873a";
      const leftMargin = 55;
      const contentWidth = doc.page.width - 110;

      // --- Header with logo ---
      try {
        const logoPath = getLogoPath();
        const logoData = readFileSync(logoPath);
        const logoWidth = 120;
        const logoX = (doc.page.width - logoWidth) / 2;
        doc.image(logoData, logoX, doc.y, { width: logoWidth });
        doc.moveDown(4.5);
      } catch {
        // Logo not available
      }

      doc.font("Helvetica-Bold").fontSize(16).fillColor(green)
        .text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS", { align: "center" });
      doc.moveDown(0.6);
      doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + contentWidth, doc.y).strokeColor(gold).lineWidth(0.5).stroke();
      doc.moveDown(0.8);

      // --- Partes ---
      const contratanteDoc = sale.client_document ? `, ${sale.client_document}` : "";
      const contratanteEmail = sale.client_email ? `, e-mail ${sale.client_email}` : "";
      const contratanteTel = sale.client_phone ? `, telefone ${sale.client_phone}` : "";
      const providerDocStr = provider.document ? `, ${provider.document}` : "";
      const providerAddr = provider.address ? `, com sede em ${provider.address}` : "";
      const providerEmailStr = provider.email ? `, e-mail ${provider.email}` : "";

      doc.font("Helvetica").fontSize(9.5).fillColor(dark)
        .text(
          `Pelo presente instrumento particular, de um lado, ${sale.client_name.toUpperCase()}${contratanteDoc}${contratanteEmail}${contratanteTel}, doravante denominado(a) CONTRATANTE, e de outro lado, ${provider.name.toUpperCase()}${providerDocStr}${providerAddr}${providerEmailStr}, doravante denominada CONTRATADA, celebram o presente contrato de prestação de serviços, que se regerá pelas cláusulas e condições a seguir:`,
          { align: "justify", lineGap: 2 }
        );

      doc.moveDown(0.8);
      doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + contentWidth, doc.y).strokeColor(gold).lineWidth(0.3).stroke();
      doc.moveDown(0.8);

      doc.fillColor(green).fontSize(10).font("Helvetica-Bold").text("Cláusula 1ª — Do Objeto");
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(9).fillColor(dark)
        .text(`O presente instrumento tem por objeto a prestação do serviço denominado "${sale.item_name}", conforme especificações acordadas entre as partes.`, { align: "justify", lineGap: 2 });

      doc.moveDown(0.7);
      doc.fillColor(green).fontSize(10).font("Helvetica-Bold").text("Cláusula 2ª — Do Valor e Forma de Pagamento");
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(9).fillColor(dark)
        .text(`Pela prestação dos serviços objeto deste contrato, o CONTRATANTE pagará à CONTRATADA o valor total de ${formatBRL(sale.amount_cents)} (${valueInWords(sale.amount_cents)}), a ser quitado via ${formatMethod(sale.payment_method, sale.installments)}. O não pagamento nas datas acordadas acarretará a incidência de multa de 2% (dois por cento) sobre o valor devido, acrescida de juros de mora de 1% (um por cento) ao mês.`, { align: "justify", lineGap: 2 });

      doc.moveDown(0.7);
      doc.fillColor(green).fontSize(10).font("Helvetica-Bold").text("Cláusula 3ª — Das Obrigações do CONTRATANTE");
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(9).fillColor(dark)
        .text("Compete ao CONTRATANTE efetuar os pagamentos na forma e prazos acordados, fornecer as informações necessárias à boa execução dos serviços com veracidade e tempestividade, observar os horários e compromissos da agenda acordada, e manter conduta respeitosa e colaborativa.", { align: "justify", lineGap: 2 });

      doc.moveDown(0.7);
      doc.fillColor(green).fontSize(10).font("Helvetica-Bold").text("Cláusula 4ª — Das Obrigações da CONTRATADA");
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(9).fillColor(dark)
        .text("Compete à CONTRATADA executar os serviços contratados com zelo, ética, diligência e profissionalismo, disponibilizar profissional qualificado e compatível com o escopo contratado, cumprir o cronograma e os prazos acordados, e proteger as informações recebidas do CONTRATANTE.", { align: "justify", lineGap: 2 });

      doc.moveDown(0.7);
      doc.fillColor(green).fontSize(10).font("Helvetica-Bold").text("Cláusula 5ª — Da Vigência e Rescisão");
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(9).fillColor(dark)
        .text("Este contrato entra em vigor na data de sua assinatura e permanece vigente até a conclusão dos serviços contratados. A rescisão poderá ocorrer por mútuo acordo, por inadimplemento mediante notificação prévia de 15 dias, ou por justa causa nos termos da legislação vigente.", { align: "justify", lineGap: 2 });

      doc.moveDown(0.7);
      doc.fillColor(green).fontSize(10).font("Helvetica-Bold").text("Cláusula 6ª — Da Confidencialidade");
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(9).fillColor(dark)
        .text("As partes comprometem-se a manter sigilo absoluto sobre todas as informações pessoais, profissionais e sensíveis compartilhadas durante a vigência deste contrato e por prazo de 2 (dois) anos após seu encerramento, respeitando integralmente a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).", { align: "justify", lineGap: 2 });

      doc.moveDown(0.7);
      doc.fillColor(green).fontSize(10).font("Helvetica-Bold").text("Cláusula 7ª — Da LGPD");
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(9).fillColor(dark)
        .text("Os dados pessoais coletados no âmbito deste contrato serão tratados exclusivamente para as finalidades de execução contratual e cumprimento de obrigação legal, nos termos da Lei nº 13.709/2018. O CONTRATANTE poderá solicitar acesso, correção ou eliminação de seus dados pessoais a qualquer momento.", { align: "justify", lineGap: 2 });

      doc.moveDown(0.7);
      doc.fillColor(green).fontSize(10).font("Helvetica-Bold").text("Cláusula 8ª — Do Direito de Imagem e Propriedade Intelectual");
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(9).fillColor(dark)
        .text("Esta contratação não autoriza a utilização do nome, imagem ou voz do CONTRATANTE para fins publicitários. Os materiais e metodologias da CONTRATADA são de sua propriedade intelectual, sendo concedida ao CONTRATANTE autorização de uso pessoal, vedada reprodução ou revenda.", { align: "justify", lineGap: 2 });

      doc.moveDown(0.7);
      doc.fillColor(green).fontSize(10).font("Helvetica-Bold").text("Cláusula 9ª — Da Multa");
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(9).fillColor(dark)
        .text("O descumprimento de qualquer cláusula deste contrato sujeitará a parte infratora ao pagamento de multa compensatória equivalente a 20% (vinte por cento) do valor total do contrato, sem prejuízo da obrigação de reparar integralmente os danos causados.", { align: "justify", lineGap: 2 });

      if (sale.notes) {
        doc.moveDown(0.7);
        doc.fillColor(green).fontSize(10).font("Helvetica-Bold").text("Observações");
        doc.moveDown(0.25);
        doc.font("Helvetica").fontSize(9).fillColor(dark).text(sale.notes, { align: "justify", lineGap: 2 });
      }

      doc.moveDown(0.7);
      doc.fillColor(green).fontSize(10).font("Helvetica-Bold").text("Cláusula 10ª — Das Condições Gerais");
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(9).fillColor(dark)
        .text("Este contrato representa o acordo integral entre as partes. Alterações somente terão validade se realizadas por escrito e assinadas por ambas as partes. As partes admitem a utilização de meios eletrônicos para assinatura e comunicação, conferindo-lhes plena validade jurídica.", { align: "justify", lineGap: 2 });

      doc.moveDown(0.7);
      doc.fillColor(green).fontSize(10).font("Helvetica-Bold").text("Cláusula 11ª — Do Foro");
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(9).fillColor(dark)
        .text("As partes elegem o foro da comarca do domicílio do CONTRATANTE para dirimir quaisquer dúvidas oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja, ressalvado o direito do consumidor de optar pelo foro de seu domicílio.", { align: "justify", lineGap: 2 });

      // --- Encerramento ---
      if (doc.y > doc.page.height - 200) doc.addPage();

      doc.moveDown(1);
      doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + contentWidth, doc.y).strokeColor(gold).lineWidth(0.3).stroke();
      doc.moveDown(1);

      doc.font("Helvetica").fontSize(9).fillColor(dark)
        .text("E por estarem assim justos e contratados, assinam o presente instrumento em duas vias de igual teor e forma, na presença das testemunhas abaixo.", { align: "justify" });

      doc.moveDown(0.8);
      doc.font("Helvetica").fontSize(9).fillColor(dark).text(formatDateLong(sale.sale_date), { align: "right" });

      doc.moveDown(3);
      const y = doc.y;
      const lineWidth = 190;

      doc.moveTo(leftMargin, y).lineTo(leftMargin + lineWidth, y).strokeColor(dark).lineWidth(0.5).stroke();
      doc.fontSize(8).fillColor(dark).text("CONTRATANTE", leftMargin, y + 5, { width: lineWidth, align: "center" });
      doc.text(sale.client_name, leftMargin, y + 17, { width: lineWidth, align: "center" });

      const rightX = leftMargin + contentWidth - lineWidth;
      doc.moveTo(rightX, y).lineTo(rightX + lineWidth, y).strokeColor(dark).lineWidth(0.5).stroke();
      doc.fontSize(8).fillColor(dark).text("CONTRATADA", rightX, y + 5, { width: lineWidth, align: "center" });
      doc.text(provider.name, rightX, y + 17, { width: lineWidth, align: "center" });

      // --- Footer on all pages ---
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.font("Helvetica").fontSize(7).fillColor(muted)
          .text(
            `Contrato — ${provider.name} — Página ${i + 1} de ${pages.count}`,
            leftMargin, doc.page.height - 35,
            { width: contentWidth, align: "center" }
          );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function generateContractPdfFromSnapshot(snapshot: ContractSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 55, right: 55 },
        bufferPages: true,
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

      const green = "#1a2e18";
      const dark = "#2c2c2c";
      const muted = "#6b6152";
      const gold = "#b8873a";
      const contentWidth = doc.page.width - 110;
      const leftMargin = 55;

      // --- Header with logo ---
      let logoLoaded = false;
      try {
        const logoPath = getLogoPath();
        const logoData = readFileSync(logoPath);
        const logoWidth = 120;
        const logoX = (doc.page.width - logoWidth) / 2;
        doc.image(logoData, logoX, doc.y, { width: logoWidth });
        doc.moveDown(4.5);
        logoLoaded = true;
      } catch {
        // Logo not available — proceed without it
      }

      doc.font("Helvetica-Bold").fontSize(16).fillColor(green)
        .text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS", { align: "center" });
      doc.moveDown(0.15);
      doc.font("Helvetica").fontSize(9).fillColor(muted)
        .text(`Nº ${snapshot.contract_number}`, { align: "center" });
      if (!logoLoaded) {
        doc.moveDown(0.1);
        doc.font("Helvetica").fontSize(8).fillColor(muted)
          .text(snapshot.contratada.nome_fantasia, { align: "center" });
      }

      doc.moveDown(0.6);
      doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + contentWidth, doc.y).strokeColor(gold).lineWidth(0.5).stroke();
      doc.moveDown(0.8);

      // --- Partes — estilo formal de contrato brasileiro ---
      doc.font("Helvetica").fontSize(9.5).fillColor(dark);

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

      doc.moveDown(0.8);
      doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + contentWidth, doc.y).strokeColor(gold).lineWidth(0.3).stroke();
      doc.moveDown(0.8);

      // --- Cláusulas base ---
      for (const clausula of snapshot.clausulas_base) {
        if (doc.y > doc.page.height - 120) doc.addPage();
        doc.font("Helvetica-Bold").fontSize(10).fillColor(green).text(clausula.titulo);
        doc.moveDown(0.25);
        doc.font("Helvetica").fontSize(9).fillColor(dark).text(clausula.texto, { align: "justify", lineGap: 2 });
        doc.moveDown(0.7);
      }

      // --- Módulo específico ---
      if (snapshot.modulo_especifico.length > 0) {
        doc.moveDown(0.3);
        doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + contentWidth, doc.y).strokeColor(gold).lineWidth(0.3).stroke();
        doc.moveDown(0.6);

        for (const modulo of snapshot.modulo_especifico) {
          if (doc.y > doc.page.height - 120) doc.addPage();
          doc.font("Helvetica-Bold").fontSize(10).fillColor(green).text(modulo.titulo);
          doc.moveDown(0.25);
          doc.font("Helvetica").fontSize(9).fillColor(dark).text(modulo.texto, { align: "justify", lineGap: 2 });
          doc.moveDown(0.6);
        }
      }

      // --- Encerramento e assinaturas ---
      if (doc.y > doc.page.height - 200) doc.addPage();

      doc.moveDown(0.5);
      doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + contentWidth, doc.y).strokeColor(gold).lineWidth(0.3).stroke();
      doc.moveDown(1);

      doc.font("Helvetica").fontSize(9).fillColor(dark)
        .text("E por estarem assim justos e contratados, assinam o presente instrumento em duas vias de igual teor e forma, na presença das testemunhas abaixo.", { align: "justify" });

      doc.moveDown(0.8);
      doc.font("Helvetica").fontSize(9).fillColor(dark)
        .text(snapshot.quadro_resumo.data_contrato, { align: "right" });

      doc.moveDown(3);
      const sigY = doc.y;
      const lineW = 190;

      doc.moveTo(leftMargin, sigY).lineTo(leftMargin + lineW, sigY).strokeColor(dark).lineWidth(0.5).stroke();
      doc.fontSize(8).fillColor(dark).text("CONTRATANTE", leftMargin, sigY + 5, { width: lineW, align: "center" });
      doc.text(snapshot.contratante.nome, leftMargin, sigY + 17, { width: lineW, align: "center" });
      if (snapshot.contratante.documento) {
        doc.text(snapshot.contratante.documento, leftMargin, sigY + 29, { width: lineW, align: "center" });
      }

      const rX = leftMargin + contentWidth - lineW;
      doc.moveTo(rX, sigY).lineTo(rX + lineW, sigY).strokeColor(dark).lineWidth(0.5).stroke();
      doc.fontSize(8).fillColor(dark).text("CONTRATADA", rX, sigY + 5, { width: lineW, align: "center" });
      doc.text(snapshot.contratada.razao_social, rX, sigY + 17, { width: lineW, align: "center" });
      if (snapshot.contratada.cnpj) {
        doc.text(snapshot.contratada.cnpj, rX, sigY + 29, { width: lineW, align: "center" });
      }

      // --- Testemunhas ---
      const witY = sigY + 60;
      if (witY < doc.page.height - 80) {
        doc.moveDown(3);
        doc.font("Helvetica-Bold").fontSize(8).fillColor(muted).text("Testemunhas:", leftMargin);
        doc.moveDown(1.5);
        const witLineY = doc.y;
        doc.moveTo(leftMargin, witLineY).lineTo(leftMargin + lineW, witLineY).strokeColor(muted).lineWidth(0.3).stroke();
        doc.fontSize(7).fillColor(muted).text("Nome / CPF", leftMargin, witLineY + 4, { width: lineW, align: "center" });

        doc.moveTo(rX, witLineY).lineTo(rX + lineW, witLineY).strokeColor(muted).lineWidth(0.3).stroke();
        doc.fontSize(7).fillColor(muted).text("Nome / CPF", rX, witLineY + 4, { width: lineW, align: "center" });
      }

      // --- Footer on all pages ---
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.font("Helvetica").fontSize(7).fillColor(muted)
          .text(
            `Contrato ${snapshot.contract_number} — ${snapshot.contratada.nome_fantasia} — Página ${i + 1} de ${pages.count}`,
            leftMargin, doc.page.height - 35,
            { width: contentWidth, align: "center" }
          );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
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
