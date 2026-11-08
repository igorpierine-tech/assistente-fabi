"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import styles from "./Dashboard.module.css";
import type { CalendarEvent } from "./CalendarView";
import { apiFetch } from "@/lib/api";

interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  origin?: string;
  sessions?: number;
  lastDate?: string;
  isNew?: boolean;
}

interface KPIs {
  today: { count: number };
  week: { count: number };
  month: {
    appointments: number;
    completed: number;
    cancelled: number;
    completionRate: number;
    lastMonthAppointments: number;
  };
  revenue: { thisMonth: number; lastMonth: number; trend: number };
  receivables: {
    pending: number;
    pendingCount: number;
    received: number;
    overdue: number;
    overdueCount: number;
  };
  contracts: { thisMonth: number; signed: number };
  topType: { type: string; count: number } | null;
  upcoming: Array<{
    id: string;
    title: string;
    clientName: string | null;
    startTime: string;
    endTime: string;
    type: string;
    status: string;
  }>;
}

interface DashboardProps {
  userName: string;
  events: CalendarEvent[];
  clients: Client[];
  onNavigate: (view: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  constelacao: "Constelação",
  consultoria_financeira: "Consultoria",
  planejamento: "Planejamento",
  reuniao: "Reunião",
  bloqueio_pessoal: "Bloqueio",
  evento_curso: "Evento",
  mentoria_individual: "Mentoria Individual",
  mentoria_grupo: "Mentoria Grupo",
  outro: "Outro",
};

const BORDER_COLORS: Record<string, string> = {
  constelacao: "#b8873a",
  consultoria_financeira: "#d9b268",
  planejamento: "#2f4a2b",
  reuniao: "#6b6152",
  bloqueio_pessoal: "#8a7f6a",
  evento_curso: "#1a2e18",
  mentoria_individual: "#7c5e2c",
  mentoria_grupo: "#5a7a3b",
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatDateLabel() {
  const d = new Date();
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "long" }).toUpperCase();
  const day = d.getDate();
  const month = d.toLocaleDateString("pt-BR", { month: "short" }).toUpperCase().replace(".", "");
  const year = d.getFullYear();
  return `${weekday} · ${day} ${month} ${year}`;
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Cuiaba",
  });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Cuiaba",
  }).replace(".", "");
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function getTypeLabel(type: string) {
  return TYPE_LABELS[type] || type.replace(/_/g, " ");
}

function getTimeUntilNext(events: CalendarEvent[]) {
  const now = new Date();
  const upcoming = events.filter(e => new Date(e.startDate) > now);
  if (upcoming.length === 0) return null;
  const diff = new Date(upcoming[0].startDate).getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `em ${hours}h${minutes > 0 ? ` ${minutes}min` : ""}`;
  if (minutes > 0) return `em ${minutes}min`;
  return "agora";
}

function TrendBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const isUp = value > 0;
  return (
    <span className={`${styles.trend} ${isUp ? styles.trendUp : styles.trendDown}`}>
      {isUp ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  );
}

interface DailyDevotion {
  title: string;
  text: string;
  reflexao: string;
  oQueFazer: string;
  pergunta: string;
  afirmacao: string;
  versiculo: string;
  versiculoRef: string;
}

const DAILY_DEVOTIONS: DailyDevotion[] = [
  { title: "O poder da cocriação", text: "Você não está aqui por acaso. Deus o criou com um propósito único e o dotou de todas as ferramentas necessárias para manifestar uma vida plena. Na física quântica, a observação muda a realidade — seu foco e intenção são forças criadoras. Quando você alinha sua força interior com o propósito divino, torna-se um cocriador consciente.", reflexao: "Eu sou cocriador da minha realidade. Cada pensamento e ação que alinho com Deus transforma meu mundo.", oQueFazer: "Antes de cada atendimento hoje, respire fundo e declare mentalmente sua capacidade e propósito.", pergunta: "Em quais áreas da minha vida ainda estou agindo como espectador, em vez de cocriador?", afirmacao: "Eu sou forte, capaz e cocriador do meu destino junto a Deus. Minha vida manifesta milagres.", versiculo: "Tudo posso naquele que me fortalece.", versiculoRef: "Filipenses 4:13" },
  { title: "A frequência da abundância", text: "A abundância começa quando reconhecemos que somos guiados. O universo opera por frequências — gratidão, confiança e generosidade são as mais elevadas. Na cocriação, a confiança é o primeiro passo para manifestar provisão. Quando você vibra na frequência da abundância, atrai mais razões para ser abundante.", reflexao: "A provisão divina é infinita. Quando confio e agradeço, abro os canais para recebê-la.", oQueFazer: "Anote 3 coisas pelas quais você é grato hoje antes de iniciar o trabalho.", pergunta: "Estou vibrando na frequência da escassez ou da abundância em meus pensamentos diários?", afirmacao: "Eu confio na provisão divina e abro espaço para receber abundância ilimitada.", versiculo: "O Senhor é o meu pastor, nada me faltará.", versiculoRef: "Salmos 23:1" },
  { title: "O plano da prosperidade", text: "Deus já traçou o caminho da prosperidade para você. Seu papel como cocriador é alinhar suas ações diárias com esse plano maior. Na neurociência, a visualização ativa as mesmas redes neurais que a experiência real — quando você visualiza o plano de Deus se cumprindo, seu cérebro já começa a trabalhar para torná-lo realidade.", reflexao: "Existe um plano de prosperidade traçado para mim. Minhas ações diárias precisam se alinhar a ele.", oQueFazer: "Defina uma intenção clara para este dia e visualize-a se concretizando por 3 minutos.", pergunta: "Minhas ações de hoje estão me aproximando ou me afastando do plano de Deus para minha vida?", afirmacao: "Os planos de Deus para mim são de prosperidade e eu caminho nessa direção com fé.", versiculo: "Porque eu sei os planos que tenho para vocês, planos de prosperidade e não de calamidade.", versiculoRef: "Jeremias 29:11" },
  { title: "A entrega do controle", text: "A mente analítica tem limites. A cocriação acontece quando entregamos o controle e confiamos no processo divino. Resistir ao fluxo da vida gera sofrimento; aceitar e confiar gera transformação. Na física quântica, o estado de superposição nos ensina que múltiplas possibilidades existem simultaneamente — a confiança colapsa essas possibilidades na melhor realidade.", reflexao: "O controle excessivo bloqueia os milagres. A entrega consciente abre portas inimagináveis.", oQueFazer: "Quando surgir ansiedade hoje, pause, respire e repita internamente: eu confio no processo.", pergunta: "O que estou tentando controlar que seria melhor entregar à sabedoria divina?", afirmacao: "Eu entrego minha necessidade de controle e confio plenamente no fluxo da vida.", versiculo: "Confie no Senhor de todo o seu coração e não se apoie em seu próprio entendimento.", versiculoRef: "Provérbios 3:5" },
  { title: "A força na espera", text: "Esperar não é passividade — é preparo ativo. Na cocriação, os momentos de espera são momentos de fortalecimento interior. A neurociência confirma que períodos de descanso e silêncio são quando o cérebro consolida aprendizados e gera insights criativos. Deus usa a espera para nos fortalecer e preparar para o que vem.", reflexao: "Os períodos de espera são tempos de fortalecimento. A paciência é uma ferramenta de cocriação.", oQueFazer: "Reserve 5 minutos de silêncio entre seus atendimentos para recarregar suas energias.", pergunta: "Estou usando meus momentos de espera para crescer ou para me frustrar?", afirmacao: "Minha energia se renova a cada momento de espera e eu subo mais alto a cada dia.", versiculo: "Os que esperam no Senhor renovarão as suas forças; subirão com asas como águias.", versiculoRef: "Isaías 40:31" },
  { title: "A coragem que liberta", text: "O medo é o maior bloqueador da cocriação. Quando você elimina o medo, abre canais para que o extraordinário se manifeste em sua vida. A neurociência mostra que o medo ativa o modo de sobrevivência do cérebro, fechando o acesso à criatividade e intuição. A coragem reconecta você ao seu potencial cocriador.", reflexao: "O medo fecha portas que a coragem abre. Cada ato de coragem é um passo na cocriação.", oQueFazer: "Identifique um medo que está travando uma decisão importante e dê o primeiro passo hoje.", pergunta: "Que oportunidades extraordinárias estou perdendo por deixar o medo decidir por mim?", afirmacao: "Eu libero todo medo e acolho a coragem que Deus depositou em meu coração.", versiculo: "Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus.", versiculoRef: "Isaías 41:10" },
  { title: "O poder da gratidão", text: "A gratidão é a frequência mais poderosa da cocriação. Quando agradecemos, sinalizamos ao universo que estamos prontos para receber mais. A ciência comprova que a gratidão libera dopamina e serotonina, criando um ciclo positivo de bem-estar. Na Palavra, agradecer em tudo é um mandamento porque Deus sabe que a gratidão transforma a realidade.", reflexao: "Agradecer não é apenas educação — é uma ferramenta quântica de transformação da realidade.", oQueFazer: "Envie uma mensagem de agradecimento genuíno a alguém que impactou positivamente sua semana.", pergunta: "Tenho agradecido pelas bênçãos que já tenho ou apenas pedido pelas que ainda não chegaram?", afirmacao: "Eu sou grato por tudo que tenho e por tudo que está a caminho de se manifestar.", versiculo: "Em tudo dai graças, porque esta é a vontade de Deus em Cristo Jesus para convosco.", versiculoRef: "1 Tessalonicenses 5:18" },
  { title: "O amor como frequência", text: "Todo atendimento é um ato de amor. Na cocriação, servir com amor genuíno multiplica os resultados para todos. O amor é a frequência mais elevada do universo — quando você opera a partir dele, ativa campos quânticos de possibilidade infinita. A Palavra nos ensina que o amor tudo suporta, tudo crê e tudo espera.", reflexao: "Servir com amor genuíno não esgota — multiplica. É a base de toda cocriação verdadeira.", oQueFazer: "Dedique atenção plena ao primeiro cliente do dia, como se fosse a pessoa mais importante do mundo.", pergunta: "Estou servindo por obrigação ou por amor? Qual é a frequência que estou emitindo?", afirmacao: "Eu sirvo com amor e cada atendimento transforma vidas, inclusive a minha própria.", versiculo: "O amor é paciente, o amor é bondoso. Não inveja, não se vangloria, não se orgulha.", versiculoRef: "1 Coríntios 13:4" },
  { title: "A arte da entrega", text: "Entregar não é desistir — é cocriar com sabedoria. Faça sua parte com excelência e deixe Deus cuidar do que está além do seu alcance. Na física quântica, a interferência do observador pode colapsar possibilidades. Às vezes, soltar o controle permite que a melhor possibilidade se manifeste naturalmente.", reflexao: "Fazer minha parte e entregar o resultado é o equilíbrio perfeito da cocriação consciente.", oQueFazer: "Liste suas preocupações do dia e, ao lado de cada uma, escreva: 'Entregue a Deus'.", pergunta: "O que estou segurando tão forte que está impedindo Deus de agir na situação?", afirmacao: "Eu faço minha parte com excelência e entrego cada resultado à sabedoria de Deus.", versiculo: "Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.", versiculoRef: "Salmos 37:5" },
  { title: "O princípio do dar", text: "Dar é o princípio fundamental da cocriação. Quanto mais valor você entrega ao mundo, mais valor retorna para sua vida. Esse é um princípio universal — na física, toda ação gera uma reação. Na economia divina, a generosidade ativa uma corrente de abundância que transcende a lógica humana.", reflexao: "A generosidade não diminui — ela planta sementes de uma colheita que eu ainda não posso ver.", oQueFazer: "Ofereça algo além do esperado em um atendimento hoje — seu tempo, atenção ou conhecimento.", pergunta: "Estou retendo por medo de perder, ou semeando com fé no retorno divino?", afirmacao: "Eu sou generoso com meu conhecimento e minha generosidade me enriquece em todas as áreas.", versiculo: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito.", versiculoRef: "João 3:16" },
  { title: "A escolha da alegria", text: "A alegria é um estado de escolha, não de circunstância. Na cocriação, escolher a alegria eleva sua frequência vibracional e atrai mais motivos para se alegrar. A neurociência comprova que sorrir — mesmo forçadamente — libera endorfinas. Imagine o que a alegria genuína é capaz de fazer na sua realidade.", reflexao: "A alegria não depende de circunstâncias — é uma decisão que eleva minha frequência cocriadora.", oQueFazer: "Comece seu dia com uma música que eleva seu espírito e mantenha essa energia nos atendimentos.", pergunta: "Estou esperando condições perfeitas para me alegrar, ou escolhendo a alegria agora?", afirmacao: "Eu escolho a alegria hoje, independente das circunstâncias, e atraio mais motivos para celebrar.", versiculo: "Alegrem-se sempre no Senhor. Novamente direi: alegrem-se!", versiculoRef: "Filipenses 4:4" },
  { title: "O motor da coragem", text: "A coragem é o motor da cocriação. Cada passo corajoso que você dá abre portas que antes pareciam invisíveis. Deus não nos deu espírito de covardia, mas de poder. Na neurofisiologia, enfrentar o medo libera adrenalina e dopamina — a mesma química da conquista. Ser corajoso não é ausência de medo, é agir apesar dele.", reflexao: "A coragem não elimina o medo — ela age apesar dele. E cada ação corajosa abre novas portas.", oQueFazer: "Faça hoje aquela ligação, proposta ou decisão que você vem adiando por medo.", pergunta: "Qual porta está esperando minha coragem para ser aberta hoje?", afirmacao: "Eu sou corajoso e avanço com determinação em direção aos meus objetivos mais elevados.", versiculo: "Sede fortes e corajosos. Não temais, nem vos espanteis, porque o Senhor vosso Deus é convosco.", versiculoRef: "Josué 1:9" },
  { title: "Tornar-se luz", text: "Quando você se torna luz, ilumina o caminho dos outros. Na cocriação, sua luz interior é a ferramenta mais poderosa de transformação. A física nos mostra que a luz é simultaneamente onda e partícula — ela se adapta ao que é necessário. Assim deve ser o cocriador: flexível, luminoso, presente.", reflexao: "Minha luz interior não se apaga ao iluminar os outros — ela se multiplica.", oQueFazer: "Ao atender cada pessoa hoje, visualize uma luz dourada envolvendo vocês dois durante a sessão.", pergunta: "Estou permitindo que minha luz brilhe plenamente ou a escondendo por medo do julgamento?", afirmacao: "Eu sou luz e minha presença transforma positivamente todos os ambientes por onde passo.", versiculo: "O Senhor é a minha luz e a minha salvação; a quem temerei?", versiculoRef: "Salmos 27:1" },
  { title: "O tempo de cada coisa", text: "Respeitar o tempo é cocriar com sabedoria. Nem tudo precisa ser agora — o momento certo potencializa cada ação. A natureza nos ensina isso: a semente precisa de tempo para germinar, a fruta precisa de tempo para amadurecer. Na cocriação, a paciência não é espera — é respeito pelo ritmo divino.", reflexao: "Forçar o tempo de Deus é desperdiçar energia. Respeitar Seu ritmo é sabedoria cocriadora.", oQueFazer: "Reorganize sua agenda priorizando o que realmente importa hoje, sem pressa desnecessária.", pergunta: "Estou tentando apressar algo que Deus está amadurecendo no tempo perfeito?", afirmacao: "Eu respeito o tempo divino e confio que tudo chega e floresce na hora certa.", versiculo: "Tudo tem o seu tempo determinado, e há tempo para todo propósito debaixo do céu.", versiculoRef: "Eclesiastes 3:1" },
  { title: "O descanso produtivo", text: "Descansar é parte essencial da cocriação. Você não produz mais quando se esgota — produz mais quando se renova. A neurociência confirma que o sono e o descanso são quando o cérebro processa informações, consolida memórias e gera soluções criativas. Deus descansou no sétimo dia — o descanso é divino.", reflexao: "O descanso não é preguiça — é sabedoria. Meu corpo e mente precisam de renovação para cocriar.", oQueFazer: "Programe uma pausa real hoje, sem celular, por pelo menos 15 minutos de silêncio restaurador.", pergunta: "Estou honrando meu corpo e mente com o descanso que eles precisam para funcionar no melhor nível?", afirmacao: "Eu me permito descansar com dignidade e sei que meu descanso é produtivo e necessário.", versiculo: "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.", versiculoRef: "Mateus 11:28" },
  { title: "A bênção que multiplica", text: "Abençoar é estender a cocriação para outros. Quando você abençoa alguém, ativa uma corrente de bem que retorna multiplicada. Na tradição bíblica, a bênção não é apenas palavras — é transferência de energia divina. A física quântica nos mostra que a intenção dirigida pode influenciar campos de energia.", reflexao: "Cada bênção que envio retorna multiplicada. Abençoar é o ato mais generoso da cocriação.", oQueFazer: "Ao encerrar cada atendimento hoje, deseje algo genuinamente bom e específico ao seu cliente.", pergunta: "Quantas oportunidades de abençoar alguém eu deixei passar por estar distraído?", afirmacao: "Eu abençoo cada pessoa que cruza meu caminho e sou abençoado em retorno.", versiculo: "O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti.", versiculoRef: "Números 6:24-25" },
  { title: "O poder do pedido", text: "Pedir é o primeiro ato da cocriação. Deus espera que você declare o que deseja para que Ele possa agir. A clareza do pedido direciona a energia criadora do universo. Na neurociência, declarar um objetivo em voz alta ativa redes neurais de comprometimento e aumenta drasticamente as chances de realização.", reflexao: "Deus não lê nas entrelinhas — Ele quer que eu declare com clareza e fé o que desejo.", oQueFazer: "Escreva um pedido específico a Deus e leia em voz alta com convicção e gratidão.", pergunta: "Tenho sido específico nos meus pedidos ou vago demais para que o universo responda?", afirmacao: "Eu peço com fé, busco com persistência e recebo com gratidão tudo que é meu por direito.", versiculo: "Peçam, e lhes será dado; busquem, e encontrarão; batam, e a porta lhes será aberta.", versiculoRef: "Mateus 7:7" },
  { title: "Tudo coopera para o bem", text: "Até os desafios são parte da cocriação. O que parece obstáculo é, na verdade, material de construção para algo maior. Na física, a pressão transforma carvão em diamante. Na vida, os desafios forjam caráter e revelam forças que não sabíamos ter. Deus faz todas as coisas cooperarem — até as difíceis.", reflexao: "Os desafios não são punição — são materiais de construção que Deus usa para edificar algo maior.", oQueFazer: "Relembre um desafio recente e escreva três aprendizados ou forças que ele revelou em você.", pergunta: "Consigo ver a mão de Deus trabalhando nos meus desafios ou só enxergo o problema?", afirmacao: "Tudo coopera para o meu bem. Cada desafio me fortalece e me aproxima do meu propósito.", versiculo: "Sabemos que todas as coisas cooperam para o bem daqueles que amam a Deus.", versiculoRef: "Romanos 8:28" },
  { title: "A compaixão que cria", text: "A compaixão é a cola da cocriação coletiva. Quando você é bondoso, cria um campo de possibilidades para todos ao seu redor. A ciência mostra que atos de bondade liberam ocitocina — o hormônio da conexão — em quem pratica, em quem recebe e até em quem assiste. A compaixão é literalmente contagiosa.", reflexao: "Minha bondade cria ondas que alcançam pessoas que eu nem posso ver. A compaixão é multiplicadora.", oQueFazer: "Pratique um ato de bondade inesperado com alguém que não espera nada de você hoje.", pergunta: "Estou sendo compassivo com os outros e comigo mesmo, ou me cobrando demais?", afirmacao: "Eu sou bondoso e minha compaixão cria milagres ao meu redor todos os dias.", versiculo: "Sejam bondosos e compassivos uns para com os outros, perdoando-se mutuamente.", versiculoRef: "Efésios 4:32" },
  { title: "O deleite que alinha", text: "O deleite alinha seu coração com o coração de Deus. Na cocriação, quando seus desejos se alinham com o propósito divino, eles se manifestam com naturalidade. Deleitar-se em Deus não é obrigação — é prazer. Quando você encontra genuíno prazer na presença divina, seus desejos mais profundos são revelados e atendidos.", reflexao: "Quando meu deleite está em Deus, meus desejos se alinham naturalmente com Seu propósito para mim.", oQueFazer: "Medite por 3 minutos sobre o que seu coração verdadeiramente deseja — sem filtros ou julgamentos.", pergunta: "Meus desejos estão nascendo do meu ego ou do meu propósito alinhado com Deus?", afirmacao: "Meus desejos estão alinhados com o propósito de Deus e se manifestam no tempo perfeito.", versiculo: "Deleita-te no Senhor, e ele te concederá o que deseja o teu coração.", versiculoRef: "Salmos 37:4" },
  { title: "Onde está seu tesouro", text: "Sua atenção determina sua realidade. Na cocriação, investir energia no que é verdadeiramente valioso multiplica seus resultados exponencialmente. A neurociência confirma: onde você coloca foco, seu cérebro cria conexões mais fortes. Se seu foco está na escassez, verá escassez. Se está na abundância, encontrará abundância.", reflexao: "Minha atenção é meu recurso mais valioso. Onde a coloco define o que manifesto na minha vida.", oQueFazer: "Revise onde está gastando mais tempo e energia e redirecione conscientemente para o que gera valor.", pergunta: "Se alguém observasse onde gasto meu tempo e energia, o que concluiria sobre o que valorizo?", afirmacao: "Eu invisto minha energia no que realmente importa e colho abundância em todas as áreas.", versiculo: "Onde estiver o vosso tesouro, aí estará também o vosso coração.", versiculoRef: "Mateus 6:21" },
  { title: "A paz que decide", text: "A paz interior é a base da cocriação consciente. Quando você está em paz, suas decisões são mais sábias e seus resultados mais consistentes. A neurociência mostra que o estresse crônico reduz o córtex pré-frontal — a área do planejamento e decisão. A paz ativa essa região, permitindo escolhas melhores.", reflexao: "Decisões tomadas na paz geram resultados duradouros. O caos produz respostas, não soluções.", oQueFazer: "Antes de uma decisão importante hoje, busque primeiro a paz interior — respire, ore, silencie.", pergunta: "Estou tomando decisões a partir da paz ou da ansiedade? Qual é a base das minhas escolhas?", afirmacao: "A paz de Cristo habita em mim e guia todas as minhas decisões com sabedoria divina.", versiculo: "A minha paz vos dou; não vo-la dou como o mundo a dá. Não se perturbe o coração.", versiculoRef: "João 14:27" },
  { title: "Misericórdias que renovam", text: "Cada dia é um novo início na cocriação. O passado não determina seu futuro — a misericórdia de Deus renova suas possibilidades a cada manhã. Na física quântica, cada momento é um novo ponto de colapso de possibilidades. Ontem já foi; hoje é uma tela em branco para você cocriar com Deus.", reflexao: "A cada manhã, recebo uma nova chance de cocriar. O ontem não define meu hoje.", oQueFazer: "Solte algo do passado que está pesando — escreva-o em um papel e rasgue como ato simbólico.", pergunta: "O que do meu passado ainda estou carregando que Deus já renovou com Sua misericórdia?", afirmacao: "Hoje é um novo começo cheio de possibilidades e eu abraço cada uma delas com fé.", versiculo: "As misericórdias do Senhor são a causa de não sermos consumidos; renovam-se cada manhã.", versiculoRef: "Lamentações 3:22-23" },
  { title: "O abrigo do Altíssimo", text: "Proteção e cocriação caminham juntas. Quando você se abriga em Deus, cria a partir de um lugar seguro. O medo e a insegurança consomem energia criadora; a segurança divina a libera. Na neurociência, o senso de segurança ativa o sistema nervoso parassimpático, permitindo criatividade, empatia e visão de longo prazo.", reflexao: "Criar a partir de um lugar de segurança divina libera todo meu potencial cocriador.", oQueFazer: "Declare proteção sobre seu trabalho, seus clientes e sua família logo ao acordar.", pergunta: "Estou cocriando a partir da segurança de Deus ou da insegurança do mundo?", afirmacao: "Eu habito no abrigo do Altíssimo e de lá cocrío uma realidade extraordinária.", versiculo: "Aquele que habita no abrigo do Altíssimo descansará à sombra do Todo-Poderoso.", versiculoRef: "Salmos 91:1" },
  { title: "Permanecer conectado", text: "Permanecer conectado à fonte é o segredo da cocriação frutífera. Sem conexão com Deus, não há fruto sustentável. A videira nutre os ramos — separado dela, o ramo seca. Sua conexão diária com a Palavra, a oração e o silêncio é o que mantém o fluxo de cocriação ativo e produtivo.", reflexao: "Frutos sustentáveis nascem da conexão constante com a fonte. Sem raízes, não há colheita.", oQueFazer: "Encontre um momento hoje — mesmo que breve — para orar e renovar sua conexão com Deus.", pergunta: "Estou vivendo conectado à Videira ou tentando produzir frutos por conta própria?", afirmacao: "Eu permaneço conectado a Deus e minha vida produz frutos abundantes e duradouros.", versiculo: "Eu sou a videira; vocês são os ramos. Se alguém permanecer em mim e eu nele, dará muito fruto.", versiculoRef: "João 15:5" },
  { title: "Semear com fé", text: "Semear sem garantia é fé em ação. Na cocriação, cada semente lançada com fé retorna multiplicada no tempo certo. O agricultor não desenterra a semente para ver se está crescendo — ele confia no processo. Assim também na cocriação: semeie, regue com fé e confie que a colheita virá.", reflexao: "Nem toda semente germina imediatamente, mas toda semente lançada com fé produz no tempo certo.", oQueFazer: "Invista em algo hoje sem esperar retorno imediato — pode ser seu tempo, conhecimento ou um recurso.", pergunta: "Tenho semeado com fé e paciência, ou desistindo quando a colheita não é imediata?", afirmacao: "Eu semeio com fé e colho com alegria no tempo determinado por Deus.", versiculo: "Lança o teu pão sobre as águas, porque depois de muitos dias o acharás.", versiculoRef: "Eclesiastes 11:1" },
  { title: "Planejar e confiar", text: "Planeje com sabedoria, mas permita que Deus ajuste a rota. A cocriação perfeita une seu planejamento com a direção divina. O GPS recalcula a rota quando você faz um desvio — Deus faz o mesmo com sua vida. Planeje, mas mantenha flexibilidade para os ajustes divinos.", reflexao: "O melhor plano é aquele que inclui espaço para os ajustes e surpresas de Deus.", oQueFazer: "Revise seus planos do mês e pergunte em oração: isso está alinhado com meu propósito maior?", pergunta: "Meus planos têm espaço para a intervenção divina ou são rígidos demais?", afirmacao: "Eu planejo com sabedoria e permito com serenidade que Deus direcione meus passos.", versiculo: "O coração do homem traça o seu caminho, mas o Senhor lhe dirige os passos.", versiculoRef: "Provérbios 16:9" },
  { title: "Valorizar cada dia", text: "Cada dia é precioso na cocriação. Quando você valoriza o tempo, transforma momentos comuns em extraordinários. A sabedoria não vem com os anos — vem com a consciência. Contar os dias com propósito é viver cada um como uma oportunidade irrepetível de cocriar algo significativo.", reflexao: "Cada dia é uma oportunidade única e irrepetível de cocriar. A sabedoria começa quando percebo isso.", oQueFazer: "Ao final do dia, registre em um caderno ou nota uma vitória — por menor que pareça.", pergunta: "Estou vivendo cada dia com a consciência de que ele é único, ou apenas deixando o tempo passar?", afirmacao: "Eu valorizo cada dia como um presente divino e faço dele uma obra-prima de cocriação.", versiculo: "Ensina-nos a contar os nossos dias, para que alcancemos coração sábio.", versiculoRef: "Salmos 90:12" },
  { title: "A mente renovada", text: "A mente renovada é a mente cocriadora. Quando você muda seus pensamentos, muda sua realidade. A neuroplasticidade prova que o cérebro se remodela conforme nossos pensamentos habituais. Pensamentos de fé, abundância e propósito literalmente criam novas conexões neurais que sustentam uma vida transformada.", reflexao: "Meus pensamentos habituais estão moldando meu cérebro e minha realidade a cada instante.", oQueFazer: "Substitua conscientemente um pensamento limitante por uma verdade bíblica cada vez que ele surgir hoje.", pergunta: "Que pensamentos repetitivos estão moldando minha realidade atual? Eles estão me servindo?", afirmacao: "Minha mente se renova diariamente pela Palavra e eu cocrío uma realidade extraordinária.", versiculo: "Não se conformem com este mundo, mas transformem-se pela renovação da sua mente.", versiculoRef: "Romanos 12:2" },
  { title: "Os frutos do Espírito", text: "Os frutos do Espírito são os sinais de uma cocriação saudável e alinhada com Deus. Quando você cultiva amor, alegria, paz, paciência, amabilidade, bondade, fidelidade, mansidão e domínio próprio, tudo ao seu redor floresce. Esses frutos não são apenas virtudes — são frequências que atraem o melhor da vida.", reflexao: "Os frutos do Espírito são indicadores de que minha cocriação está alinhada com o propósito divino.", oQueFazer: "Escolha um fruto do Espírito para cultivar intencionalmente hoje em todos os seus relacionamentos.", pergunta: "Qual fruto do Espírito precisa ser mais cultivado na minha vida agora? Por quê?", afirmacao: "Os frutos do Espírito se manifestam abundantemente em mim e através de mim todos os dias.", versiculo: "O fruto do Espírito é amor, alegria, paz, paciência, amabilidade, bondade, fidelidade, mansidão e domínio próprio.", versiculoRef: "Gálatas 5:22-23" },
  { title: "Refúgio na tempestade", text: "Nos momentos difíceis, a cocriação não para — ela se fortalece. Deus é seu refúgio e de lá você pode cocriar com mais força do que nunca. A pressão cria diamantes. As tempestades fortalecem raízes. As crises revelam recursos internos que você não sabia ter. Seu refúgio em Deus é o ponto de partida para uma cocriação resiliente.", reflexao: "As tempestades não interrompem a cocriação — elas revelam minha verdadeira força interior.", oQueFazer: "Se estiver passando por um momento difícil, pare agora e busque refúgio na oração sincera.", pergunta: "Estou usando minhas dificuldades como desculpa para parar ou como combustível para avançar?", afirmacao: "Em toda angústia, Deus é meu refúgio e minha força se renova para cocriar com mais poder.", versiculo: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.", versiculoRef: "Salmos 46:1" },
];

function getDailyDevotion(): DailyDevotion {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return DAILY_DEVOTIONS[dayOfYear % DAILY_DEVOTIONS.length];
}

function getApptProgress(startTime: string, now: Date) {
  const start = new Date(startTime).getTime();
  const current = now.getTime();
  if (current >= start) return 100;
  const WINDOW = 24 * 60 * 60 * 1000;
  const remaining = start - current;
  if (remaining >= WINDOW) return 0;
  return Math.round(((WINDOW - remaining) / WINDOW) * 100);
}

function getApptCountdown(startTime: string, now: Date) {
  const start = new Date(startTime).getTime();
  const diff = start - now.getTime();
  if (diff <= 0) return "agora";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h${minutes > 0 ? ` ${minutes}min` : ""}`;
  return `${minutes}min`;
}

export function Dashboard({ userName, events, clients, onNavigate }: DashboardProps) {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchKPIs = useCallback(async () => {
    try {
      const res = await apiFetch("/dashboard/kpis");
      if (res.ok) setKpis(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchKPIs(); }, [fetchKPIs]);

  const handleMarkCompleted = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(`/appointments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "concluido" }),
      });
      if (res.ok) fetchKPIs();
    } catch {}
  }, [fetchKPIs]);

  const todayEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return events
      .filter((e) => {
        const d = new Date(e.startDate);
        return d >= today && d < tomorrow;
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [events]);

  const newClientsThisMonth = useMemo(
    () => clients.filter((c) => c.isNew).length,
    [clients]
  );

  const monthTrend = kpis
    ? (kpis.month.lastMonthAppointments > 0
        ? Math.round(((kpis.month.appointments - kpis.month.lastMonthAppointments) / kpis.month.lastMonthAppointments) * 100)
        : kpis.month.appointments > 0 ? 100 : 0)
    : 0;

  const timeUntilNext = useMemo(() => getTimeUntilNext(todayEvents), [todayEvents]);
  const hasOverdue = kpis && kpis.receivables.overdueCount > 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.topBar}>
        <div className={styles.greeting}>
          <div className={styles.dateLabel}>{formatDateLabel()}</div>
          <h1 className={styles.hello}>
            {getGreeting()}, <span className={styles.helloName}>{userName || "profissional"}</span>
          </h1>
        </div>
        <div className={styles.topActions}>
          <input
            type="text"
            className={styles.searchBox}
            placeholder="Buscar cliente, evento..."
          />
        </div>
      </div>

      {/* KPI Strip */}
      <div className={styles.statsRow}>
        <div className={`${styles.statCard} ${styles.statCardPrimary}`}>
          <div className={styles.statIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className={styles.statLabel}>HOJE</div>
          <div className={styles.statValue}>{todayEvents.length}</div>
          <div className={styles.statSub}>
            {todayEvents.length === 1 ? "atendimento" : "atendimentos"}
            {timeUntilNext && <span className={styles.statHint}> · próximo {timeUntilNext}</span>}
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          </div>
          <div className={styles.statLabel}>SEMANA</div>
          <div className={styles.statValue}>{kpis?.week.count ?? 0}</div>
          <div className={styles.statSub}>
            sessões
            {monthTrend !== 0 && <> <TrendBadge value={monthTrend} /></>}
          </div>
        </div>

        <div className={`${styles.statCard} ${kpis && kpis.revenue.trend < 0 ? styles.statCardWarning : ""}`}>
          <div className={styles.statIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          </div>
          <div className={styles.statLabel}>RECEBIDO</div>
          <div className={styles.statValue} style={{ fontSize: "1.6rem" }}>
            {kpis ? formatCurrency(kpis.receivables.received) : "—"}
          </div>
          <div className={styles.statSub}>
            no mês {kpis && kpis.revenue.trend !== 0 && <TrendBadge value={kpis.revenue.trend} />}
          </div>
        </div>

        <div className={`${styles.statCard} ${hasOverdue ? styles.statCardDanger : ""}`}>
          <div className={`${styles.statIcon} ${hasOverdue ? styles.statIconDanger : ""}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {hasOverdue ? (
                <>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </>
              ) : (
                <>
                  <rect x="2" y="6" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                </>
              )}
            </svg>
          </div>
          <div className={styles.statLabel}>{hasOverdue ? "EM ATRASO" : "A RECEBER"}</div>
          <div className={`${styles.statValue} ${hasOverdue ? styles.statValueDanger : ""}`} style={{ fontSize: "1.6rem" }}>
            {kpis ? formatCurrency(hasOverdue ? kpis.receivables.overdue : kpis.receivables.pending) : "—"}
          </div>
          <div className={styles.statSub}>
            {hasOverdue
              ? `${kpis!.receivables.overdueCount} cobranças`
              : kpis ? `${kpis.receivables.pendingCount} pendentes` : "pendentes"}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className={styles.mainGrid}>
        {/* Left column */}
        <div className={styles.leftColumn}>
        <div className={styles.appointmentsCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Próximos atendimentos</h2>
            <button className={styles.viewAllBtn} onClick={() => onNavigate("agenda")} type="button">
              Ver agenda →
            </button>
          </div>

          {(!kpis || kpis.upcoming.length === 0) ? (
            <div className={styles.emptyState}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                <rect x="3" y="4" width="18" height="17" rx="2" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="16" y1="2" x2="16" y2="6" />
              </svg>
              <div className={styles.emptyText}>Nenhum atendimento agendado</div>
              <div className={styles.emptySubtext}>Aproveite para organizar sua semana</div>
              <div className={styles.emptyActions}>
                <button className={styles.emptyActionBtn} onClick={() => onNavigate("agenda")} type="button">Ver agenda</button>
                <button className={styles.emptyActionBtn} onClick={() => onNavigate("clientes")} type="button">Novo cliente</button>
              </div>
            </div>
          ) : (
            <div className={styles.appointmentsList}>
              {kpis.upcoming.map((appt) => {
                const displayName = appt.clientName || appt.title.split(" — ")[0];
                const typeColor = BORDER_COLORS[appt.type] || "#b8873a";
                return (
                  <div key={appt.id} className={styles.appointmentItem}>
                    <div
                      className={styles.appointmentAvatar}
                      style={{ background: `linear-gradient(135deg, ${typeColor}, ${typeColor}88)` }}
                    >
                      <span>{getInitials(displayName)}</span>
                    </div>
                    <div className={styles.appointmentInfo} onClick={() => onNavigate("agenda")}>
                      <div className={styles.appointmentName}>{displayName}</div>
                      <div className={styles.appointmentMeta}>
                        <span className={styles.appointmentType} style={{ color: typeColor }}>
                          {getTypeLabel(appt.type)}
                        </span>
                      </div>
                      {(() => {
                        const progress = getApptProgress(appt.startTime, now);
                        const countdown = getApptCountdown(appt.startTime, now);
                        const isUrgent = progress >= 96;
                        const isSoon = progress >= 83;
                        return (
                          <div className={styles.appointmentProgressWrap}>
                            <div className={styles.appointmentProgressTrack}>
                              <div
                                className={`${styles.appointmentProgressFill} ${isUrgent ? styles.progressUrgent : isSoon ? styles.progressSoon : ""}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className={`${styles.appointmentCountdown} ${isUrgent ? styles.countdownUrgent : isSoon ? styles.countdownSoon : ""}`}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M6 2h12" /><path d="M6 22h12" /><path d="M7 2v4l5 6-5 6v4" /><path d="M17 2v4l-5 6 5 6v4" />
                              </svg>
                              {countdown}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                    <div className={styles.appointmentTime}>
                      <div className={styles.appointmentDate}>{formatShortDate(appt.startTime)}</div>
                      <div className={styles.appointmentHour}>{formatTime(appt.startTime)}</div>
                    </div>
                    <div className={styles.appointmentActions}>
                      <button
                        className={styles.appointmentActionBtn}
                        onClick={() => handleMarkCompleted(appt.id)}
                        title="Marcar como concluído"
                        type="button"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </button>
                      <button
                        className={styles.appointmentActionBtn}
                        onClick={() => onNavigate("agenda")}
                        title="Ver detalhes"
                        type="button"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

          {/* Milagre da Cocriação */}
          {(() => {
            const devotion = getDailyDevotion();
            const today = new Date();
            const dayNum = today.getDate();
            const monthName = today.toLocaleDateString("pt-BR", { month: "long" });
            return (
              <div className={styles.verseCard}>
                <div className={styles.verseHeader}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                  </svg>
                  <h3 className={styles.cardTitle}>Milagre da Cocriação</h3>
                </div>
                <div className={styles.devotionDate}>{dayNum} de {monthName}</div>
                <h4 className={styles.devotionTitle}>{devotion.title}</h4>
                <p className={styles.devotionMainText}>{devotion.text}</p>

                <div className={styles.devotionSidebar}>
                  <div className={styles.devotionBox}>
                    <h5 className={styles.devotionBoxLabel}>Reflexão do Dia</h5>
                    <p className={styles.devotionBoxText}>{devotion.reflexao}</p>
                  </div>
                  <div className={styles.devotionBox}>
                    <h5 className={styles.devotionBoxLabel}>O Que Fazer</h5>
                    <p className={styles.devotionBoxText}>{devotion.oQueFazer}</p>
                  </div>
                  <div className={styles.devotionBox}>
                    <h5 className={styles.devotionBoxLabel}>Pergunta Reflexiva</h5>
                    <p className={styles.devotionBoxText}>{devotion.pergunta}</p>
                  </div>
                  <div className={styles.devotionBoxHighlight}>
                    <h5 className={styles.devotionBoxLabel}>Afirmação de Poder</h5>
                    <p className={styles.devotionBoxTextBold}>{devotion.afirmacao}</p>
                  </div>
                  <div className={styles.devotionBoxVerse}>
                    <h5 className={styles.devotionBoxLabel}>Versículo</h5>
                    <p className={styles.devotionBoxTextItalic}>&ldquo;{devotion.versiculo}&rdquo;</p>
                    <cite className={styles.devotionBoxRef}>{devotion.versiculoRef}</cite>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right column */}
        <div className={styles.rightColumn}>
          {/* Destaques do mês */}
          {kpis && (
            <div className={styles.insightsCard}>
              <h3 className={styles.cardTitle}>Destaques do mês</h3>
              <div className={styles.insightsList}>
                {kpis.topType && (
                  <button className={`${styles.insightItem} ${styles.insightItemPrimary}`} onClick={() => onNavigate("dashboards")} type="button">
                    <span className={`${styles.insightIcon} ${styles.insightIconPrimary}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20V10M18 20V4M6 20v-4" />
                      </svg>
                    </span>
                    <div className={styles.insightText}>
                      <strong>{getTypeLabel(kpis.topType.type)}</strong>
                      <span>{kpis.topType.count} {kpis.topType.count === 1 ? "atendimento" : "atendimentos"} — mais realizado</span>
                    </div>
                    <span className={styles.insightArrow}>→</span>
                  </button>
                )}
                {kpis.contracts.thisMonth > 0 && (
                  <button className={`${styles.insightItem} ${styles.insightItemSuccess}`} onClick={() => onNavigate("contratos")} type="button">
                    <span className={`${styles.insightIcon} ${styles.insightIconSuccess}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
                        <path d="M14 2v6h6" />
                      </svg>
                    </span>
                    <div className={styles.insightText}>
                      <strong>{kpis.contracts.thisMonth} {kpis.contracts.thisMonth === 1 ? "contrato" : "contratos"}</strong>
                      <span>{kpis.contracts.signed > 0 ? `${kpis.contracts.signed} assinado${kpis.contracts.signed > 1 ? "s" : ""}` : "este mês"}</span>
                    </div>
                    <span className={styles.insightArrow}>→</span>
                  </button>
                )}
                {newClientsThisMonth > 0 && (
                  <button className={`${styles.insightItem} ${styles.insightItemSuccess}`} onClick={() => onNavigate("clientes")} type="button">
                    <span className={`${styles.insightIcon} ${styles.insightIconSuccess}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                        <path d="M22 4L12 14.01l-3-3" />
                      </svg>
                    </span>
                    <div className={styles.insightText}>
                      <strong>{newClientsThisMonth} {newClientsThisMonth === 1 ? "novo cliente" : "novos clientes"}</strong>
                      <span>este mês</span>
                    </div>
                    <span className={styles.insightArrow}>→</span>
                  </button>
                )}
                {kpis.month.cancelled > 0 && (
                  <button className={`${styles.insightItem} ${styles.insightItemWarning}`} onClick={() => onNavigate("agenda")} type="button">
                    <span className={`${styles.insightIcon} ${styles.insightIconWarning}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                    </span>
                    <div className={styles.insightText}>
                      <strong>{kpis.month.cancelled} {kpis.month.cancelled === 1 ? "cancelamento" : "cancelamentos"}</strong>
                      <span>este mês</span>
                    </div>
                    <span className={styles.insightArrow}>→</span>
                  </button>
                )}
                {kpis.month.completionRate >= 80 && kpis.month.completed > 0 && (
                  <button className={`${styles.insightItem} ${styles.insightItemSuccess}`} onClick={() => onNavigate("dashboards")} type="button">
                    <span className={`${styles.insightIcon} ${styles.insightIconSuccess}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                    <div className={styles.insightText}>
                      <strong>Taxa de conclusão: {kpis.month.completionRate}%</strong>
                      <span>excelente desempenho</span>
                    </div>
                    <span className={styles.insightArrow}>→</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className={styles.quickActionsCard}>
            <button className={styles.primaryAction} onClick={() => onNavigate("agenda")} type="button">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="17" rx="2" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="12" y1="14" x2="12" y2="18" />
                <line x1="10" y1="16" x2="14" y2="16" />
              </svg>
              Nova sessão
            </button>
            <div className={styles.secondaryActions}>
              <button className={styles.secondaryAction} onClick={() => onNavigate("clientes")} type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="7" r="4" />
                  <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
                <span>Novo cliente</span>
              </button>
              <button className={styles.secondaryAction} onClick={() => onNavigate("financeiro")} type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                </svg>
                <span>Financeiro</span>
              </button>
              <button className={styles.secondaryAction} onClick={() => onNavigate("dashboards")} type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" />
                  <path d="M7 16l4-6 4 4 5-8" />
                </svg>
                <span>Relatórios</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
