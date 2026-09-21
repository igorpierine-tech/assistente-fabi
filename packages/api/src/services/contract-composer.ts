import type { Sale } from "./sales-db";
import type { ClientRow, TenantConfigRow } from "./database";
import { getServiceDefinition } from "./contracts-db";

export interface ContractSnapshot {
  schema_version: string;
  contract_number: string;
  revision: number;
  locale: string;
  timezone: string;
  service_code: string;
  service_name: string;
  contratante: {
    nome: string;
    documento: string | null;
    email: string | null;
    telefone: string | null;
    endereco: string | null;
    tipo_pessoa: string | null;
    inscricao_estadual: string | null;
  };
  contratada: {
    razao_social: string;
    nome_fantasia: string;
    cnpj: string | null;
    endereco: string | null;
    email: string | null;
    telefone: string | null;
    representante_nome: string | null;
    representante_cargo: string | null;
  };
  servico: {
    codigo: string;
    nome: string;
    descricao: string | null;
    modalidade: string | null;
    quantidade_encontros: number | null;
    duracao_minutos: number | null;
  };
  financeiro: {
    moeda: string;
    valor_total_centavos: number;
    forma_pagamento: string | null;
    parcelas: number;
    resumo_pagamento: string;
  };
  quadro_resumo: QuadroResumo;
  clausulas_base: ClausulaResolvida[];
  modulo_especifico: ClausulaResolvida[];
  emitido_em: string | null;
  especifico: Record<string, unknown>;
}

export interface QuadroResumo {
  numero_contrato: string;
  revisao: number;
  contratante: string;
  contratada: string;
  servico: string;
  modalidade: string;
  encontros: string;
  valor: string;
  pagamento: string;
  data_contrato: string;
}

export interface ClausulaResolvida {
  id: string;
  titulo: string;
  texto: string;
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

function formatMethod(method: string | null, installments: number): string {
  if (!method) return "A combinar";
  const label = METHOD_LABELS[method] || method;
  if (installments > 1) return `${label} em ${installments}x`;
  return label;
}

function formatDateBR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

interface ComposeInput {
  sale: Sale;
  client?: ClientRow | null;
  tenant?: TenantConfigRow | null;
  contractNumber: string;
  revision: number;
  especifico?: Record<string, unknown>;
}

export function composeSnapshot(input: ComposeInput): ContractSnapshot {
  const { sale, client, tenant, contractNumber, revision, especifico } = input;

  const providerName = process.env.CONTRACT_PROVIDER_NAME || tenant?.business_name || "Prestador de Serviços";
  const providerDoc = process.env.CONTRACT_PROVIDER_DOCUMENT || null;
  const providerEmail = process.env.CONTRACT_PROVIDER_EMAIL || null;
  const providerPhone = process.env.CONTRACT_PROVIDER_PHONE || null;
  const providerAddress = process.env.CONTRACT_PROVIDER_ADDRESS || null;
  const providerRepName = tenant?.owner_name || null;

  const serviceDef = getServiceDefinition(sale.item_name) || getServiceDefinitionByName(sale.item_name);

  const serviceCode = serviceDef?.code || "outro";
  const serviceName = serviceDef?.name || sale.item_name;

  const resumoPagamento = `${formatBRL(sale.amount_cents)} via ${formatMethod(sale.payment_method, sale.installments)}`;

  const contratante = {
    nome: client?.name || sale.client_name,
    documento: client?.document || sale.client_document || null,
    email: client?.email || sale.client_email || null,
    telefone: client?.phone || sale.client_phone || null,
    endereco: client?.address || null,
    tipo_pessoa: client?.tipo_pessoa || "PF",
    inscricao_estadual: client?.inscricao_estadual || null,
  };

  const contratada = {
    razao_social: providerName,
    nome_fantasia: tenant?.business_name || "Raízes & Riquezas",
    cnpj: providerDoc,
    endereco: providerAddress,
    email: providerEmail,
    telefone: providerPhone,
    representante_nome: providerRepName,
    representante_cargo: tenant?.profession || null,
  };

  const quadroResumo: QuadroResumo = {
    numero_contrato: contractNumber,
    revisao: revision,
    contratante: contratante.nome,
    contratada: `${contratada.nome_fantasia}${contratada.cnpj ? ` — CNPJ ${contratada.cnpj}` : ""}`,
    servico: serviceName,
    modalidade: "Conforme acordado entre as partes",
    encontros: "Conforme quadro contratual",
    valor: formatBRL(sale.amount_cents),
    pagamento: resumoPagamento,
    data_contrato: formatDateBR(sale.sale_date),
  };

  const vars: Record<string, string> = {
    "contrato.numero": contractNumber,
    "contratante.nome": contratante.nome,
    "contratante.documento": contratante.documento || "[documento não informado]",
    "contratante.endereco": contratante.endereco || "[endereço não informado]",
    "contratante.email": contratante.email || "[e-mail não informado]",
    "contratada.razao_social": contratada.razao_social,
    "contratada.cnpj": contratada.cnpj || "[CNPJ não informado]",
    "contratada.endereco": contratada.endereco || "[endereço não informado]",
    "contratada.email": contratada.email || "[e-mail não informado]",
    "contratada.representante_nome": contratada.representante_nome || "[representante não informado]",
    "contratada.representante_cargo": contratada.representante_cargo || "[cargo não informado]",
    "servico.nome": serviceName,
    "servico.modalidade": quadroResumo.modalidade,
    "financeiro.resumo_pagamento": resumoPagamento,
    "privacidade.canal_titular": contratada.email || "e-mail da Contratada",
  };

  const resolve = (text: string): string => {
    return text.replace(/\{\{([^}]+)\}\}/g, (_m, key: string) => {
      const trimmed = key.trim();
      return vars[trimmed] || `[${trimmed}]`;
    });
  };

  const clausulasBase = buildBaseClauses(resolve);
  const moduloEspecifico = buildModuleClauses(serviceCode, resolve, especifico || {});

  return {
    schema_version: "1.0",
    contract_number: contractNumber,
    revision,
    locale: "pt-BR",
    timezone: tenant?.timezone || "America/Cuiaba",
    service_code: serviceCode,
    service_name: serviceName,
    contratante,
    contratada,
    servico: {
      codigo: serviceCode,
      nome: serviceName,
      descricao: serviceDef?.family || null,
      modalidade: null,
      quantidade_encontros: null,
      duracao_minutos: null,
    },
    financeiro: {
      moeda: "BRL",
      valor_total_centavos: sale.amount_cents,
      forma_pagamento: sale.payment_method,
      parcelas: sale.installments,
      resumo_pagamento: resumoPagamento,
    },
    quadro_resumo: quadroResumo,
    clausulas_base: clausulasBase,
    modulo_especifico: moduloEspecifico,
    emitido_em: null,
    especifico: especifico || {},
  };
}

function getServiceDefinitionByName(name: string) {
  const normalized = name.toLowerCase().trim();
  const defs = [
    { code: "perfil_comportamental", pattern: "perfil comportamental" },
    { code: "coaching_pessoal", pattern: "coaching" },
    { code: "constelacao_empresarial", pattern: "constelação empresarial" },
    { code: "constelacao_familiar", pattern: "constelação familiar" },
    { code: "equipes_diagnostico_inicial", pattern: "desenvolvimento de equipes" },
    { code: "empresa_diagnostico_inicial", pattern: "diagnóstico empresarial" },
    { code: "diagnostico_financeiro", pattern: "diagnóstico financeiro" },
    { code: "mentoria_individual_12", pattern: "mentoria individual" },
    { code: "mentoria_grupo", pattern: "mentoria em grupo" },
    { code: "palestra_motivacional", pattern: "palestra" },
    { code: "workshop_lideranca", pattern: "workshop" },
  ];
  for (const d of defs) {
    if (normalized.includes(d.pattern)) {
      return getServiceDefinition(d.code);
    }
  }
  return null;
}

function buildBaseClauses(resolve: (t: string) => string): ClausulaResolvida[] {
  return [
    {
      id: "clausula_1",
      titulo: "Cláusula 1ª — Do Objeto",
      texto: resolve(`O presente instrumento tem por objeto a prestação do serviço de {{servico.nome}}, conforme especificações, objetivos, entregáveis e cronograma acordados entre as partes e detalhados no módulo específico deste contrato. Serviços adicionais ou complementares não previstos neste instrumento dependerão de aditivo contratual firmado por ambas as partes.`),
    },
    {
      id: "clausula_2",
      titulo: "Cláusula 2ª — Do Valor e Forma de Pagamento",
      texto: resolve(`Pela prestação dos serviços objeto deste contrato, o CONTRATANTE pagará à CONTRATADA o valor total de {{financeiro.resumo_pagamento}}. O não pagamento nas datas acordadas acarretará a incidência de multa de 2% (dois por cento) sobre o valor devido, acrescida de juros de mora de 1% (um por cento) ao mês, calculados pro rata die, sem prejuízo da atualização monetária pelo IGPM/FGV ou índice que o substitua.`),
    },
    {
      id: "clausula_3",
      titulo: "Cláusula 3ª — Das Obrigações do CONTRATANTE",
      texto: resolve(`Compete ao CONTRATANTE: a) efetuar os pagamentos na forma e prazos acordados; b) fornecer à CONTRATADA todas as informações e documentos necessários à boa execução dos serviços, com veracidade e tempestividade; c) observar os horários e compromissos da agenda acordada; d) manter conduta respeitosa e colaborativa durante a execução dos serviços; e) comunicar previamente eventuais impedimentos ou necessidades de reagendamento, conforme política vigente da CONTRATADA.`),
    },
    {
      id: "clausula_4",
      titulo: "Cláusula 4ª — Das Obrigações da CONTRATADA",
      texto: resolve(`Compete à CONTRATADA: a) executar os serviços contratados com zelo, ética, diligência e profissionalismo; b) disponibilizar profissional qualificado e compatível com o escopo contratado; c) cumprir o cronograma e os prazos acordados; d) comunicar prontamente quaisquer impedimentos à execução dos serviços; e) proteger as informações recebidas do CONTRATANTE, tratando-as com confidencialidade; f) entregar os materiais e relatórios previstos no escopo contratual. Mudanças relevantes de profissional, metodologia ou escopo serão previamente comunicadas e submetidas à concordância do CONTRATANTE.`),
    },
    {
      id: "clausula_5",
      titulo: "Cláusula 5ª — Da Vigência e Rescisão",
      texto: resolve(`Este contrato entra em vigor na data de sua assinatura e permanece vigente até a conclusão dos serviços contratados, conforme cronograma do quadro-resumo. A rescisão poderá ocorrer: a) por mútuo acordo entre as partes, formalizado por escrito; b) por inadimplemento de qualquer das partes, mediante notificação prévia de 15 (quinze) dias, assegurada oportunidade de regularização; c) por justa causa, nos termos da legislação vigente. Em caso de rescisão antecipada, serão apurados os valores devidos pelos serviços já prestados e os eventuais reembolsos, conforme política comercial vigente da CONTRATADA.`),
    },
    {
      id: "clausula_6",
      titulo: "Cláusula 6ª — Da Confidencialidade",
      texto: resolve(`As partes comprometem-se a manter sigilo absoluto sobre todas as informações pessoais, profissionais, comerciais e sensíveis compartilhadas durante a vigência deste contrato e por prazo de 2 (dois) anos após seu encerramento. As informações confidenciais serão utilizadas exclusivamente para a execução dos serviços contratados, sendo vedada sua divulgação a terceiros sem prévia autorização por escrito da parte detentora. O dever de sigilo não se aplica a informações que: a) sejam ou se tornem de domínio público sem culpa da parte receptora; b) sejam exigidas por determinação judicial ou administrativa.`),
    },
    {
      id: "clausula_7",
      titulo: "Cláusula 7ª — Da Lei Geral de Proteção de Dados (LGPD)",
      texto: resolve(`As partes declaram que observarão integralmente as disposições da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais). Os dados pessoais coletados no âmbito deste contrato serão tratados exclusivamente para as finalidades de execução contratual, cumprimento de obrigação legal e exercício regular de direitos. A CONTRATADA não compartilhará dados pessoais do CONTRATANTE com terceiros, salvo quando necessário ao cumprimento do contrato ou por exigência legal. O CONTRATANTE poderá, a qualquer momento, solicitar acesso, correção, portabilidade ou eliminação de seus dados pessoais através do canal {{privacidade.canal_titular}}, nos termos da legislação vigente.`),
    },
    {
      id: "clausula_8",
      titulo: "Cláusula 8ª — Do Direito de Imagem e Propriedade Intelectual",
      texto: resolve(`Esta contratação não autoriza a utilização do nome, imagem, voz ou depoimento do CONTRATANTE para fins publicitários, de marketing ou qualquer outra finalidade comercial. Qualquer autorização nesse sentido deverá ser objeto de instrumento específico, destacado e facultativo. Os materiais, metodologias e conteúdos desenvolvidos pela CONTRATADA são de sua propriedade intelectual. O CONTRATANTE recebe autorização de uso pessoal ou interno dos materiais disponibilizados durante a prestação dos serviços, sendo vedada sua reprodução, revenda ou publicação sem autorização prévia por escrito.`),
    },
    {
      id: "clausula_9",
      titulo: "Cláusula 9ª — Da Multa",
      texto: resolve(`O descumprimento de qualquer cláusula deste contrato sujeitará a parte infratora ao pagamento de multa compensatória equivalente a 20% (vinte por cento) do valor total do contrato, sem prejuízo da obrigação de reparar integralmente os danos causados à outra parte. A aplicação da multa não exclui a possibilidade de rescisão contratual, nos termos da Cláusula 5ª.`),
    },
    {
      id: "clausula_10",
      titulo: "Cláusula 10ª — Das Condições Gerais",
      texto: resolve(`a) Este contrato representa o acordo integral entre as partes e substitui quaisquer negociações, entendimentos ou propostas anteriores sobre o mesmo objeto. b) Alterações, aditamentos ou modificações somente terão validade se realizados por escrito e assinados por ambas as partes. c) As partes admitem a utilização de meios eletrônicos para assinatura e comunicação, conferindo-lhes plena validade jurídica. d) A tolerância de qualquer das partes quanto ao descumprimento de cláusulas deste contrato não configurará renúncia, novação ou precedente. e) Caso qualquer disposição deste contrato seja considerada nula ou inexequível, as demais cláusulas permanecerão em pleno vigor.`),
    },
    {
      id: "clausula_11",
      titulo: "Cláusula 11ª — Do Foro",
      texto: resolve(`As partes elegem o foro da comarca de {{contratada.endereco}} para dirimir quaisquer dúvidas ou litígios oriundos deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja, ressalvado o direito do consumidor de optar pelo foro de seu domicílio, quando aplicável.`),
    },
  ];
}

function buildModuleClauses(serviceCode: string, resolve: (t: string) => string, especifico: Record<string, unknown>): ClausulaResolvida[] {
  const esp = (key: string) => {
    const val = especifico[key];
    if (val === undefined || val === null || val === "") return `[${key} — a definir]`;
    return String(val);
  };

  const modules: Record<string, () => ClausulaResolvida[]> = {
    perfil_comportamental: () => [{
      id: "mod_perfil",
      titulo: "Módulo — Análise de Perfil Comportamental",
      texto: resolve(`O serviço compreende aplicação do instrumento ${esp("instrumento")}, análise das respostas e ${esp("formato_devolutiva")}. Os resultados descrevem tendências no contexto da aplicação e não definem de forma absoluta a personalidade, a capacidade ou o futuro do participante. O serviço não constitui diagnóstico clínico, laudo psicológico ou avaliação psicológica regulamentada.`),
    }],
    coaching_pessoal: () => [{
      id: "mod_coaching",
      titulo: "Módulo — Coaching Pessoal",
      texto: resolve(`O serviço compreende encontros de reflexão sobre objetivos, planejamento e acompanhamento das ações acordadas, no total e duração descritos no quadro-resumo. Os objetivos iniciais são ${esp("objetivos_iniciais")} e podem ser ajustados de comum acordo. O serviço não compreende psicoterapia, diagnóstico ou tratamento de condições de saúde e não assegura promoção, renda, relacionamento ou outro resultado específico.`),
    }],
    constelacao_empresarial: () => [{
      id: "mod_const_emp",
      titulo: "Módulo — Constelação Empresarial",
      texto: resolve(`O serviço consiste em atividade reflexiva sobre o tema organizacional ${esp("tema")}, com dinâmica previamente explicada e participação voluntária. As representações e percepções produzidas são interpretações da atividade, não comprovação de fatos, diagnóstico técnico ou auditoria. Não há promessa de eficácia científica, resolução de conflitos ou desempenho empresarial. É vedado usar a atividade para acusar, constranger ou avaliar compulsoriamente trabalhadores.`),
    }],
    constelacao_familiar: () => [{
      id: "mod_const_fam",
      titulo: "Módulo — Constelação Familiar",
      texto: resolve(`O serviço consiste em atividade reflexiva e vivencial, no formato ${esp("formato_dinamica")}, sobre tema apresentado voluntariamente pelo participante. A atividade não constitui psicoterapia, diagnóstico, tratamento ou procedimento capaz de estabelecer fatos sobre familiares ou acontecimentos passados. Não há promessa de cura, reconciliação ou eficácia terapêutica. O participante pode deixar de responder, recusar exercício ou interromper a atividade.`),
    }],
    equipes_diagnostico_inicial: () => [{
      id: "mod_equipes",
      titulo: "Módulo — Desenvolvimento de Equipes – 1º Diagnóstico",
      texto: resolve(`O serviço compreende diagnóstico inicial do funcionamento da equipe ${esp("equipe")}, por meio das atividades contratadas, com análise do contexto, síntese de achados e recomendações iniciais. O serviço não inclui execução de programa de desenvolvimento, acompanhamento contínuo, investigação disciplinar ou avaliação psicológica individual.`),
    }],
    empresa_diagnostico_inicial: () => [{
      id: "mod_empresa",
      titulo: "Módulo — Diagnóstico Empresarial – 1º Diagnóstico",
      texto: resolve(`O serviço compreende levantamento inicial das áreas ${esp("areas_avaliadas")}, análise das informações disponibilizadas e apresentação de prioridades e recomendações. O diagnóstico não constitui auditoria independente, certificação de conformidade ou parecer jurídico, contábil ou tributário. A implementação das recomendações e fases posteriores não estão incluídas.`),
    }],
    diagnostico_financeiro: () => [{
      id: "mod_financeiro",
      titulo: "Módulo — Diagnóstico Financeiro",
      texto: resolve(`O serviço compreende análise gerencial das informações financeiras de ${esp("periodo_analise")}, incluindo ${esp("indicadores_escopo")}, e apresentação dos entregáveis contratados. Não inclui auditoria contábil, escrituração, parecer tributário, intermediação ou gestão de carteira. Projeções serão identificadas como cenários sujeitos a premissas, sem garantia de lucro, economia ou solvência.`),
    }],
    mentoria_individual_12: () => [{
      id: "mod_mentoria_ind",
      titulo: "Módulo — Mentoria Individual – 12 encontros",
      texto: resolve(`O programa compreende 12 encontros individuais, com duração, periodicidade e prazo de utilização definidos no quadro-resumo, sobre ${esp("temas")}. Inclui orientação baseada na experiência do mentor, discussão de alternativas e acompanhamento do plano acordado, sem execução de atividades em nome do participante nem garantia de resultado. Encontros realizados, reposições e saldo serão demonstráveis.`),
    }],
    mentoria_grupo: () => [{
      id: "mod_mentoria_grp",
      titulo: "Módulo — Mentoria em Grupo",
      texto: resolve(`O serviço será prestado à turma ${esp("turma")}, com os encontros, temas e limite de participantes descritos no quadro-resumo. A interação é coletiva e não inclui atendimento individual salvo previsão expressa. A abertura da turma depende da condição de formação informada; se não houver formação, será oferecida restituição integral ou transferência facultativa.`),
    }],
    palestra_motivacional: () => [{
      id: "mod_palestra",
      titulo: "Módulo — Palestra Motivacional",
      texto: resolve(`O serviço compreende a realização da palestra de tema ${esp("tema")}, pelo profissional ${esp("palestrante")}, na data, local e duração ajustados. Inclui apenas a preparação e os materiais descritos no escopo. A contratação não autoriza transmissão, gravação, republicação ou exploração comercial do conteúdo sem licença específica.`),
    }],
    workshop_lideranca: () => [{
      id: "mod_workshop",
      titulo: "Módulo — Workshop de Liderança",
      texto: resolve(`O serviço compreende atividade formativa sobre ${esp("temas")}, com carga horária de ${esp("carga_horaria_minutos")} minutos, combinando exposição e exercícios descritos no programa. A participação em exercícios pessoais será voluntária. Certificado, quando incluído, observará os critérios de presença informados e não conferirá habilitação profissional.`),
    }],
  };

  const builder = modules[serviceCode];
  if (builder) return builder();
  return [{
    id: "mod_generico",
    titulo: "Módulo — Serviço contratado",
    texto: resolve(`Serviço contratado: {{servico.nome}}. As condições específicas seguem o acordado entre as partes e registrado no quadro-resumo.`),
  }];
}
