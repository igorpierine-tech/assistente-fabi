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
    inscricao_estadual: string | null;
    inscricao_municipal: string | null;
    endereco: string | null;
    cep: string | null;
    email: string | null;
    telefone: string | null;
    representante_nome: string | null;
    representante_qualificacao: string | null;
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

  const providerName = tenant?.razao_social || process.env.CONTRACT_PROVIDER_NAME || tenant?.business_name || "Prestador de Serviços";
  const providerDoc = tenant?.cnpj || process.env.CONTRACT_PROVIDER_DOCUMENT || null;
  const providerEmail = tenant?.email_comercial || process.env.CONTRACT_PROVIDER_EMAIL || null;
  const providerPhone = tenant?.telefone_comercial || process.env.CONTRACT_PROVIDER_PHONE || null;
  const providerAddress = tenant?.endereco || process.env.CONTRACT_PROVIDER_ADDRESS || null;
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
    inscricao_estadual: tenant?.inscricao_estadual || null,
    inscricao_municipal: tenant?.inscricao_municipal || null,
    endereco: providerAddress,
    cep: tenant?.cep || null,
    email: providerEmail,
    telefone: providerPhone,
    representante_nome: providerRepName,
    representante_qualificacao: tenant?.representante_qualificacao || null,
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
    "contratada.inscricao_estadual": contratada.inscricao_estadual || "ISENTO",
    "contratada.inscricao_municipal": contratada.inscricao_municipal || "[IM não informada]",
    "contratada.endereco": contratada.endereco || "[endereço não informado]",
    "contratada.cep": contratada.cep || "[CEP não informado]",
    "contratada.email": contratada.email || "[e-mail não informado]",
    "contratada.representante_nome": contratada.representante_nome || "[representante não informado]",
    "contratada.representante_qualificacao": contratada.representante_qualificacao || "",
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

  const isAdesao = serviceCode === "mentoria_adesao";
  const clausulasBase = isAdesao ? [] : buildBaseClauses(resolve);
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
    { code: "mentoria_adesao", pattern: "adesão" },
    { code: "mentoria_adesao", pattern: "render como negócio" },
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
    mentoria_adesao: () => buildMentoriaAdesaoClauses(resolve, esp),
  };

  const builder = modules[serviceCode];
  if (builder) return builder();
  return [{
    id: "mod_generico",
    titulo: "Módulo — Serviço contratado",
    texto: resolve(`Serviço contratado: {{servico.nome}}. As condições específicas seguem o acordado entre as partes e registrado no quadro-resumo.`),
  }];
}

function buildMentoriaAdesaoClauses(resolve: (t: string) => string, esp: (key: string) => string): ClausulaResolvida[] {
  const nomeProg = esp("nome_programa");
  const emailContato = esp("email_contato");
  const foro = esp("foro");

  return [
    {
      id: "ma_clausula_1",
      titulo: "Cláusula 1ª — Do Objeto do Contrato",
      texto: resolve(`1.1. O(A) CONTRATANTE adquire um Infoproduto no formato de curso livre e o licenciamento temporário de videoaulas, encontros ao vivo, materiais gravados, materiais didáticos e demais conteúdos complementares disponibilizados pela CONTRATADA, nos termos do art. 42 da Lei nº 9.394/1996, denominado "${nomeProg}", composto por entregas específicas, personalizadas e de execução concentrada, não se caracterizando como prestação de trato sucessivo ou assinatura mensal. Suas entregas incluem:\na) Mentoria em Grupo: ${esp("duracao_meses")} meses de mentoria em grupo, com conteúdo voltado a Mentalidade, Posicionamento, Atração e Captação de clientes.\nb) Mentorias ao vivo: Serão, ao todo, ${esp("encontros_ao_vivo")} encontros quinzenais ao vivo e online, com duração média a ser definida pela CONTRATADA, através de plataforma de videoconferência (Zoom ou similar), em dia e horário definidos pela CONTRATADA, ocorrendo de forma coletiva com o respectivo grupo ao qual o(a) CONTRATANTE pertencer.\nc) Sessão Individual Extra: O(A) CONTRATANTE terá direito a ${esp("sessao_individual")} sessão(ões) individual(is) (1:1) com a CONTRATADA, cuja data será agendada conforme disponibilidade de agenda da CONTRATADA.\nd) Aulas Gravadas: Durante a vigência da MENTORIA, o(a) CONTRATANTE terá acesso às aulas gravadas disponibilizadas pela CONTRATADA, de forma gradativa, conforme cronograma próprio.\ne) Arquivos para Portfólio: O(A) CONTRATANTE terá acesso a arquivos e materiais de apoio destinados ao desenvolvimento de portfólio, conforme disponibilizado na plataforma.\nf) Encontros com Convidados: Poderão ocorrer, ao longo da vigência, encontros com convidados especialistas do mercado, conforme cronograma e critério exclusivo da CONTRATADA.\ng) ${esp("agente_ia")}: O(A) CONTRATANTE terá acesso, pelo período de ${esp("duracao_meses")} meses, ao agente de inteligência artificial treinado no método da CONTRATADA, disponibilizado como ferramenta de apoio.\nh) Comunidade Exclusiva: O(A) CONTRATANTE terá acesso a uma ${esp("comunidade")} de alunos em transformação, para fins de networking e trocas de experiência, devendo observar as regras de boa convivência.\ni) Scripts e Templates: O(A) CONTRATANTE terá acesso a scripts e templates de prospecção e vendas validados pela CONTRATADA.\nj) Correções de Portfólio: O(A) CONTRATANTE terá direito a correções de portfólio e feedback contínuo por parte da CONTRATADA e/ou de sua equipe, mediante solicitação.\n\n1.2. O(A) CONTRATANTE reconhece que o serviço envolve acesso imediato a conteúdo, metodologia aplicada, direcionamento estratégico e interação direta, de modo que sua execução tem início desde a respectiva disponibilização, independentemente da realização de todos os encontros ou da utilização integral das plataformas e grupos fornecidos.\n\n1.3. O cronograma das atividades será disponibilizado por meio do grupo de interações e poderá ocorrer em qualquer dia e horário, inclusive em finais de semana e feriados e/ou em horário comercial, podendo haver alteração prévia, a critério da CONTRATADA, mediante comunicação prévia.\n\n1.3.1. Eventual impossibilidade de comparecimento do(a) CONTRATANTE nos encontros ao vivo não importará em falha na prestação do serviço pela CONTRATADA ou obrigação de reagendamento, ficando ciente o(a) CONTRATANTE de que as mentorias ao vivo serão gravadas e disponibilizadas posteriormente na plataforma, podendo ser assistidas conforme sua disponibilidade.`),
    },
    {
      id: "ma_clausula_2",
      titulo: "Cláusula 2ª — Da Aquisição",
      texto: resolve(`2.1. A aquisição e o acesso se darão mediante a plataforma, presencialmente e/ou pelos demais sites e páginas de domínio da CONTRATADA.`),
    },
    {
      id: "ma_clausula_3",
      titulo: "Cláusula 3ª — Da Forma de Pagamento e do Acesso",
      texto: resolve(`3.1. O investimento da mentoria corresponde ao valor de {{financeiro.resumo_pagamento}}, a ser quitado conforme a modalidade de pagamento selecionada pelo(a) CONTRATANTE no ato da contratação, podendo a CONTRATADA ajustar as condições caso a caso.\n\n3.2. Para a aquisição, o(a) CONTRATANTE deverá efetuar o pagamento da forma escolhida, estando ciente de que eventual parcelamento constitui apenas facilidade de pagamento, não caracterizando trato sucessivo, continuidade contratual ou renovação, e que algumas formas de pagamento podem gerar tarifas cobradas pela instituição financeira ou plataforma, sendo obrigação exclusiva do(a) CONTRATANTE verificar previamente tais condições.\n\n3.3. A assinatura deste instrumento pelo(a) CONTRATANTE é condição prévia e indispensável para a formalização da contratação. Após a assinatura, o acesso ao curso será liberado em até 01 (um) dia útil, contado da confirmação do pagamento pela instituição financeira responsável pela transação, em razão de questões operacionais.\n\n3.4. Na hipótese de parcelamento, o atraso no pagamento de qualquer parcela ensejará multa de 2% sobre o valor em atraso, correção pelo IPCA e juros de 1% ao mês, pro rata die, podendo o acesso ser suspenso até a regularização do pagamento. O inadimplemento por mais de 30 (trinta) dias corridos acarretará o vencimento antecipado das demais parcelas e autorizará a CONTRATADA a emitir documentos de cobrança, protestar boletos ou duplicatas, inscrever o(a) CONTRATANTE em cadastros de inadimplentes (Serasa, SPC, etc.) e promover cobrança judicial ou extrajudicial pelo valor total devido, sem prejuízo de eventual rescisão.\n\n3.5. No pagamento parcelado, o(a) CONTRATANTE reconhece que o número de parcelas é mera condição financeira, sem relação com a duração do PROGRAMA, devendo quitar integralmente todas as parcelas mesmo após a conclusão do infoproduto.`),
    },
    {
      id: "ma_clausula_4",
      titulo: "Cláusula 4ª — Do Cadastro na Plataforma",
      texto: resolve(`4.1. Para acessar os conteúdos, o(a) CONTRATANTE deverá realizar cadastro na plataforma, fornecendo informações verdadeiras, completas e atualizadas, incluindo dados de pagamento. A CONTRATADA não se responsabiliza por falhas de acesso, prejuízos ou danos decorrentes de informações incorretas, incompletas ou falsas. A senha de acesso é de uso pessoal e intransferível, sendo o(a) CONTRATANTE o único responsável por sua guarda e por acessos indevidos decorrentes de compartilhamento ou uso inadequado.\n\n4.2. O(A) CONTRATANTE se compromete a comunicar imediatamente à CONTRATADA qualquer atividade suspeita em sua conta. A CONTRATADA poderá suspender ou cancelar a conta do(a) CONTRATANTE, sem aviso prévio e sem qualquer obrigação de restituição, caso identifique indícios de roubo de identidade, uso ilícito de meios de pagamento, desvio da finalidade do infoproduto ou qualquer atividade fraudulenta.`),
    },
    {
      id: "ma_clausula_5",
      titulo: "Cláusula 5ª — Da Vigência Contratual",
      texto: resolve(`5.1. O acesso será liberado por ${esp("duracao_meses")} meses, com início na data de disponibilização dos conteúdos, ocasião em que o presente contrato se torna definitivo. A disponibilização do conteúdo é realizada de forma única, salvo conteúdos complementares por mera liberalidade da CONTRATADA, não configurando prestação periódica ou continuidade de serviços.\n\n5.2. O(A) CONTRATANTE terá acesso ao material pelo período indicado, exclusivamente para fins de estudo e utilização individual, sem qualquer renovação automática ou cobrança recorrente, de forma que, após o período, o conteúdo e todo material a ele relacionado, inclusive eventual suporte, serão bloqueados.`),
    },
    {
      id: "ma_clausula_6",
      titulo: "Cláusula 6ª — Das Obrigações das Partes",
      texto: resolve(`6.1. Obrigações da CONTRATADA: além das obrigações previstas na legislação e as demais previstas neste Contrato, a CONTRATADA deverá: (i) assegurar o licenciamento e a liberação dos conteúdos; e (ii) oferecer suporte ao(à) CONTRATANTE no acesso ao conteúdo disponibilizado.\n\n6.2. Obrigações do(a) CONTRATANTE: além das obrigações previstas na legislação e as demais previstas neste Contrato, o(a) CONTRATANTE deverá: (i) possuir e configurar adequadamente os equipamentos necessários para a execução do objeto deste Contrato; (ii) observar as regras de conduta da comunidade, inclusive nas videoaulas, nos encontros e nos grupos fechados, prezando por um tratamento respeitoso com os demais integrantes; e (iii) indenizar eventuais danos que vier a causar à CONTRATADA e a terceiros, ocasionados pela má utilização do conteúdo ou pelo descumprimento das disposições deste Contrato.`),
    },
    {
      id: "ma_clausula_7",
      titulo: "Cláusula 7ª — Da Correta Utilização",
      texto: resolve(`7.1. É vedado ao(a) CONTRATANTE produzir, publicar, compartilhar ou transmitir qualquer conteúdo que: (i) viole a lei brasileira ou internacional aplicável; (ii) incentive crimes, violência, discriminação, preconceito, intolerância, pornografia, drogas ilícitas, terrorismo, racismo ou pirataria; (iii) infrinja direitos de propriedade intelectual de terceiros; (iv) contenha vírus ou códigos maliciosos; (v) tenha teor político, religioso, difamatório, ofensivo, falso ou prejudicial à honra e imagem de terceiros; (vi) perturbe, assedie ou ofenda demais usuários, participantes ou representantes da CONTRATADA; (vii) contenha publicidade ou promoções sem autorização prévia; ou (viii) faça referência a produtos ou serviços próprios ou de terceiros sem autorização expressa.\n\n7.2. A CONTRATADA poderá, a qualquer momento, a seu exclusivo critério e sem necessidade de prévio aviso, excluir conteúdos que contrariem estes termos ou a legislação vigente, bem como excluir o acesso do infrator, sem que a este caiba qualquer tipo de reembolso ou indenização.\n\n7.3. O(A) CONTRATANTE reconhece que é exclusivamente responsável pelo uso que fizer da plataforma, dos sites da CONTRATADA, redes sociais, ambientes de vídeo e grupos vinculados ao infoproduto, respondendo integralmente por qualquer conteúdo que inserir, inclusive nas esferas cível e criminal.`),
    },
    {
      id: "ma_clausula_8",
      titulo: "Cláusula 8ª — Do Uso Pessoal e Intransferível",
      texto: resolve(`8.1. O objeto do presente instrumento, abrangendo todos os materiais, conteúdos, eventuais bônus e demais produtos relacionados, é de uso pessoal, individual e intransferível, não podendo o(a) CONTRATANTE emprestá-lo, cedê-lo, transmiti-lo, explorá-lo, comercializá-lo ou afins, sem a prévia e expressa autorização da CONTRATADA, sob pena de responsabilização cível e criminal.`),
    },
    {
      id: "ma_clausula_9",
      titulo: "Cláusula 9ª — Da Observância à Lei Geral de Proteção de Dados Pessoais",
      texto: resolve(`9.1. Pelo presente as partes declaram que observarão as disposições da Lei nº 13.709/2018 (LGPD) e da Lei nº 12.965/2014 (Marco Civil da Internet), reconhecendo que dados pessoais possam ser reciprocamente coletados em decorrência da execução do objeto deste Contrato, sendo tratados estritamente para garantir sua execução ou para atender obrigações legais aplicáveis.\n\n9.2. O(A) CONTRATANTE poderá, a qualquer momento, mediante requisição ao e-mail ${emailContato}: (a) ter acesso aos dados; (b) exigir a correção de dados incompletos, inexatos ou desatualizados; (c) requerer a anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei; (d) requerer a portabilidade dos dados a terceiros; e (e) revogar, a qualquer tempo, o consentimento para tratamento de seus dados.`),
    },
    {
      id: "ma_clausula_10",
      titulo: "Cláusula 10ª — Dos Direitos de Propriedade Intelectual",
      texto: resolve(`10.1. A disponibilização do infoproduto e de todos os materiais e conteúdos a ele inerentes é feita de maneira não exclusiva, limitada e tão somente para informação e aprendizagem, sendo de uso estritamente pessoal, cuja aquisição não transfere, sob nenhuma forma ou pretexto, os direitos de propriedade intelectual de titularidade da CONTRATADA, ou de terceiros que a ela concederam autorização, protegidos na forma da lei e tratados internacionais pertinentes.\n\n10.2. O(A) CONTRATANTE se compromete a não reproduzir, exibir, copiar, transmitir, difundir, editar, adaptar, ceder, comercializar ou licenciar, para quaisquer fins, sem a prévia e expressa autorização da CONTRATADA, ficando sujeito às sanções civis e criminais cabíveis.\n\n10.3. O(A) CONTRATANTE autoriza a divulgação de sua imagem, nome, vídeo, voz, texto e depoimento para realização de campanhas publicitárias e institucionais da CONTRATADA, em suas redes sociais, sites e páginas de domínio, devendo tais exibições estarem de acordo com a finalidade social da CONTRATADA, a ética, a moral, os bons costumes e a boa-fé.`),
    },
    {
      id: "ma_clausula_11",
      titulo: "Cláusula 11ª — Do Não Aliciamento e da Não Concorrência",
      texto: resolve(`11.1. O(A) CONTRATANTE compromete-se a não realizar, direta ou indiretamente, por si ou por terceiros, qualquer atividade que configure concorrência com a ${nomeProg}, bem como com quaisquer produtos, serviços, métodos, processos, conteúdos, materiais ou estratégias aos quais tenha tido acesso em razão deste Contrato, por um período mínimo de 01 (um) ano, a contar da finalização do Contrato, em todo o território nacional.\n\n11.2. O(A) CONTRATANTE compromete-se a não recrutar, aliciar, contratar, subcontratar, captar ou solicitar serviços de colaboradores, prestadores ou profissionais vinculados à CONTRATADA, durante a vigência do Contrato e pelo período mínimo de 2 (dois) anos após a sua finalização, em todo o território nacional.`),
    },
    {
      id: "ma_clausula_12",
      titulo: "Cláusula 12ª — Cancelamento, Rescisão e Apuração de Valores",
      texto: resolve(`12.1. O(A) CONTRATANTE poderá exercer, no prazo de 07 (sete) dias corridos, a contar da disponibilização de acesso aos conteúdos da MENTORIA, seu direito de arrependimento, previsto no artigo 49 da Lei nº 8.078/1990 (Código de Defesa do Consumidor), mediante contato com a CONTRATADA através do e-mail ${emailContato}.\n\n12.2. Após o prazo legal de arrependimento, considerando que esta relação não configura trato sucessivo e que o investimento pactuado envolve a liberação imediata de metodologia, know-how, conteúdos digitais, acesso a grupos de interação, início das atividades e reserva de vaga pessoal e intransferível, todas entregas irreversíveis e impossíveis de serem desfeitas, fica estabelecido que não haverá devolução dos valores já pagos caso o(a) CONTRATANTE simplesmente opte por não usufruir do que lhe foi disponibilizado ou deixe de acessar os conteúdos.\n\n12.3. Sem prejuízo do disposto acima, o(a) CONTRATANTE poderá solicitar a rescisão antecipada, hipótese em que a CONTRATADA fará a apuração do valor devido, considerando o percentual de fruição do PROGRAMA, calculado com base nos conteúdos efetivamente disponibilizados, independentemente do acesso, os custos administrativos envolvidos e a multa rescisória prevista neste contrato. Nesta hipótese, a CONTRATADA fará jus aos seguintes valores compensatórios, devidos cumulativamente:\n(i) valor proporcional ao período de permanência no PROGRAMA: nos 3 (três) primeiros meses da MENTORIA, em razão da carga elevada de entregas estratégicas e implementação inicial, cada mês corresponderá a 16,66% do valor total da oferta; do 4º ao 12º mês, cada mês corresponderá a 6,66% do valor total da oferta;\n(ii) multa rescisória de 10% do valor total da oferta, como compensação mínima pelo encerramento unilateral.\n\nParágrafo único: Fica ciente e de acordo o(a) CONTRATANTE de que as porcentagens acima refletem a distribuição real dos esforços técnicos e consultivos despendidos pela CONTRATADA.\n\n12.4. Após a apuração dos valores previstos nesta cláusula, caso se verifique que o(a) CONTRATANTE permanece em débito, deverá quitar integralmente o saldo devido no prazo máximo de 30 (trinta) dias. Da mesma forma, sendo constatado saldo credor em favor do(a) CONTRATANTE, este poderá: (i) utilizar o valor como crédito para outros produtos ou serviços da CONTRATADA; ou (ii) solicitar reembolso, a ser processado em até 30 (trinta) dias a contar da assinatura de Termo de Distrato.\n\n12.5. O pedido de cancelamento somente poderá ser realizado pelo(a) CONTRATANTE titular do cadastro na plataforma e, com o seu processamento, este perderá o acesso a todo o conteúdo a partir da rescisão, bem como será excluído do grupo de interações.\n\n12.6. O(A) CONTRATANTE obriga-se a não solicitar chargeback (estorno) da compra efetuada via cartão de crédito, bem como a não abrir disputas, reclamações ou pedidos de estorno junto à instituição bancária, operadora do cartão ou plataforma de pagamento, inclusive em transações realizadas via PIX, PIX parcelado ou PIX garantido. Qualquer tentativa de bloqueio, reversão ou contestação indevida caracterizará infração contratual grave, autorizando a CONTRATADA a promover a cobrança integral dos valores devidos, acrescidos das penalidades previstas neste Contrato.`),
    },
    {
      id: "ma_clausula_13",
      titulo: "Cláusula 13ª — Da Garantia Condicional",
      texto: resolve(`13.1. Se, após 06 (seis) meses de PARTICIPAÇÃO OSTENSIVA na mentoria objeto deste Contrato, a contar da data de aquisição, o(a) CONTRATANTE comprovar que não obteve nenhuma evolução em seu negócio/portfólio, DESDE QUE COMPROVADOS CUMULATIVAMENTE os requisitos abaixo, fará jus ao reembolso integral do valor pago à CONTRATADA, conforme oferta vigente à época:\n(i) assistir a todas as aulas e entregar todas as atividades relacionadas no prazo previsto;\n(ii) participar, ao menos, de 2 (duas) mentorias ao vivo por mês;\n(iii) utilizar a Sessão Individual Extra (1:1) disponibilizada;\n(iv) submeter o portfólio para correção e aplicar o feedback recebido;\n(v) estar com os pagamentos em dia;\n(vi) comprovar, no mínimo, 06 (seis) meses de participação ostensiva;\n(vii) comprovar ao menos 03 (três) ações efetivas de prospecção/vendas;\n(viii) não ter obtido nenhum resultado/avanço comercial no período de 06 (seis) meses.\n\n13.2. Desde que o(a) CONTRATANTE comprove rigorosamente o cumprimento dos requisitos dispostos neste instrumento, fará jus ao reembolso do valor pago pelo infoproduto, em até 30 (trinta) dias. A solicitação deverá ser feita via e-mail e a CONTRATADA terá o prazo de até 30 (trinta) dias corridos para avaliar a solicitação.\n\n13.3. O(A) CONTRATANTE deverá comprovar o preenchimento dos requisitos da garantia condicional no prazo de 30 (trinta) dias, contados a partir da solicitação de garantia. Caso não o faça neste período, perderá o direito, e eventual cancelamento seguirá as regras de rescisão previstas na Cláusula Décima Segunda.\n\n13.4. O prazo previsto para pagamento somente passará a correr a partir da data da confirmação/anuência da CONTRATADA quanto à solicitação, mediante resposta ao contato enviado.`),
    },
    {
      id: "ma_clausula_14",
      titulo: "Cláusula 14ª — Das Penalidades",
      texto: resolve(`14.1. Além das outras disposições do presente contrato e sem prejuízo de quaisquer outros direitos ou recursos que a CONTRATADA possa ter por lei, inclusive em caso de violação das obrigações de não concorrência e não aliciamento, a CONTRATADA notificará o infrator para sanar a irregularidade no prazo de 07 (sete) dias, estando o(a) CONTRATANTE sujeito ao pagamento de uma multa à CONTRATADA no valor total do investimento da MENTORIA caso não atenda à notificação enviada.`),
    },
    {
      id: "ma_clausula_15",
      titulo: "Cláusula 15ª — Da Exclusão de Garantias e de Responsabilidade",
      texto: resolve(`15.1. Os conteúdos poderão ser disponibilizados em plataformas, redes sociais, sites de compartilhamento de vídeos e grupos de mensagens de titularidade e administração de terceiros. O(A) CONTRATANTE reconhece que a CONTRATADA não garante o funcionamento, estabilidade, disponibilidade ou segurança desses ambientes externos, não respondendo por interrupções, falhas de acesso, vírus, ataques cibernéticos, perda de dados ou quaisquer danos decorrentes de tais ambientes, ou ainda por caso fortuito ou força maior.\n\n15.2. O(A) CONTRATANTE declara estar ciente de que é de sua exclusiva responsabilidade providenciar, antes da aquisição, todos os pré-requisitos técnicos e cadastros necessários para acesso, incluindo dispositivos compatíveis e conexão à internet.\n\n15.3. Este Contrato constitui obrigação de meio, não garantindo ao(à) CONTRATANTE qualquer ascensão intelectual, profissional, financeira ou pessoal, ressalvada a garantia condicional prevista na Cláusula Décima Terceira. O(A) CONTRATANTE declara ter plena ciência de que o conteúdo disponibilizado representa opiniões, experiências e entendimentos pessoais da CONTRATADA, não configurando verdade absoluta, nem assegurando qualquer resultado prático ou performance específica.\n\n15.4. A CONTRATADA poderá, sem anuência do(a) CONTRATANTE, realizar qualquer alteração na plataforma, em sites, redes sociais e canais de interação, conforme julgar necessária ao melhor desenvolvimento do serviço, sem que isso acarrete qualquer prejuízo ao(à) CONTRATANTE.`),
    },
    {
      id: "ma_clausula_16",
      titulo: "Cláusula 16ª — Das Disposições Finais",
      texto: resolve(`16.1. O presente instrumento não implica na constituição de nenhum tipo de sociedade, associação, fundação ou mandato de representação entre as partes, nem se estabelece qualquer responsabilidade solidária, respondendo cada parte, individualmente, junto a terceiros, pelas suas obrigações.\n\n16.2. Mesmo na hipótese de qualquer parte deste instrumento contratual ser considerada inválida ou inexequível, as demais disposições permanecerão em pleno vigor e efeito.\n\n16.3. A CONTRATADA pode, por seu exclusivo critério e desde que comunique ao(à) CONTRATANTE, mediante aceitação deste, alterar os termos do presente contrato a qualquer momento, publicando as alterações no Portal.\n\n16.4. A tolerância de qualquer das partes quanto ao inexato cumprimento, pela outra, das obrigações assumidas neste instrumento, não implicará em renúncia ou dispensa da obrigação ou de sua penalidade, nem importará em novação.\n\n16.5. Todas as notificações e comunicações por parte do(a) CONTRATANTE à CONTRATADA são consideradas eficazes, para todos os efeitos, quando forem dirigidas ao seguinte endereço eletrônico: ${emailContato}.\n\n16.6. As Partes envolvidas neste instrumento afirmam e declaram que este poderá ser assinado eletronicamente, com fundamento no Artigo 10, parágrafo 2º da MP 2.200-2/2001, e do Artigo 6º do Decreto nº 10.278/2020, sendo as assinaturas consideradas válidas, vinculantes e executáveis.\n\n16.7. O presente instrumento será regido, interpretado e executado de acordo com as leis da República Federativa do Brasil, sendo competente o Foro de ${foro}, para dirimir qualquer dúvida ou litígio decorrente da presente contratação, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`),
    },
  ];
}
