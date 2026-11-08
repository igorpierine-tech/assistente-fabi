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
  verse: string;
  ref: string;
  reflection: string;
  decree: string;
  action: string;
}

const DAILY_DEVOTIONS: DailyDevotion[] = [
  { verse: "Tudo posso naquele que me fortalece.", ref: "Filipenses 4:13", reflection: "Você é cocriador da sua realidade. Quando alinha sua força interior com o propósito divino, não há limite para o que pode manifestar.", decree: "Eu sou forte, capaz e cocriador do meu destino junto a Deus.", action: "Antes de cada atendimento hoje, respire fundo e declare sua capacidade." },
  { verse: "O Senhor é o meu pastor, nada me faltará.", ref: "Salmos 23:1", reflection: "A abundância começa quando reconhecemos que somos guiados. Na cocriação, a confiança é o primeiro passo para manifestar provisão.", decree: "Eu confio na provisão divina e abro espaço para receber abundância.", action: "Anote 3 coisas pelas quais você é grato hoje antes de iniciar o trabalho." },
  { verse: "Porque eu sei os planos que tenho para vocês, planos de prosperidade.", ref: "Jeremias 29:11", reflection: "Deus já traçou o caminho da prosperidade. Seu papel como cocriador é alinhar suas ações diárias com esse plano maior.", decree: "Os planos de Deus para mim são de prosperidade e eu caminho nessa direção.", action: "Defina uma intenção clara para este dia e visualize-a se concretizando." },
  { verse: "Confie no Senhor de todo o seu coração.", ref: "Provérbios 3:5", reflection: "A mente analítica tem limites. A cocriação acontece quando entregamos o controle e confiamos no processo divino.", decree: "Eu entrego minha necessidade de controle e confio no fluxo da vida.", action: "Quando surgir ansiedade hoje, pause e repita: eu confio." },
  { verse: "Os que esperam no Senhor renovarão as suas forças.", ref: "Isaías 40:31", reflection: "Esperar não é passividade — é preparo ativo. Na cocriação, os momentos de espera são momentos de fortalecimento interior.", decree: "Minha energia se renova a cada momento e eu subo mais alto.", action: "Reserve 5 minutos de silêncio entre seus atendimentos para recarregar." },
  { verse: "Não temas, porque eu sou contigo.", ref: "Isaías 41:10", reflection: "O medo bloqueia a cocriação. Quando você elimina o medo, abre canais para que o extraordinário se manifeste.", decree: "Eu libero todo medo e acolho a coragem que Deus depositou em mim.", action: "Identifique um medo que está travando uma decisão e dê o primeiro passo." },
  { verse: "Em tudo dai graças.", ref: "1 Tessalonicenses 5:18", reflection: "A gratidão é a frequência mais poderosa da cocriação. Quando agradecemos, sinalizamos ao universo que estamos prontos para mais.", decree: "Eu sou grato por tudo que tenho e tudo que está a caminho.", action: "Envie uma mensagem de agradecimento a um cliente que impactou sua semana." },
  { verse: "O amor é paciente, o amor é bondoso.", ref: "1 Coríntios 13:4", reflection: "Todo atendimento é um ato de amor. Na cocriação, servir com amor genuíno multiplica os resultados para todos.", decree: "Eu sirvo com amor e cada atendimento transforma vidas, inclusive a minha.", action: "Dedique atenção extra ao primeiro cliente do dia, como se fosse o único." },
  { verse: "Entrega o teu caminho ao Senhor; confia nele.", ref: "Salmos 37:5", reflection: "Entregar não é desistir — é cocriar com sabedoria. Faça sua parte e deixe Deus cuidar do que está além do seu alcance.", decree: "Eu faço minha parte com excelência e entrego o resultado a Deus.", action: "Liste suas preocupações do dia e, ao lado de cada uma, escreva: entregue." },
  { verse: "Porque Deus amou o mundo de tal maneira que deu.", ref: "João 3:16", reflection: "Dar é o princípio fundamental da cocriação. Quanto mais valor você entrega, mais valor retorna para sua vida.", decree: "Eu sou generoso com meu conhecimento e minha generosidade me enriquece.", action: "Ofereça algo além do esperado em um atendimento hoje." },
  { verse: "Alegrem-se sempre no Senhor.", ref: "Filipenses 4:4", reflection: "A alegria é um estado de escolha, não de circunstância. Na cocriação, escolher a alegria eleva sua frequência e atrai mais motivos para se alegrar.", decree: "Eu escolho a alegria hoje, independente das circunstâncias.", action: "Comece seu dia com uma música que eleva seu espírito." },
  { verse: "Sede fortes e corajosos.", ref: "Josué 1:9", reflection: "A coragem é o motor da cocriação. Cada passo corajoso abre portas que antes pareciam invisíveis.", decree: "Eu sou corajoso e avanço com determinação em direção aos meus objetivos.", action: "Faça hoje aquela ligação ou proposta que você vem adiando." },
  { verse: "O Senhor é a minha luz e a minha salvação.", ref: "Salmos 27:1", reflection: "Quando você se torna luz, ilumina o caminho dos outros. Na cocriação, sua luz interior é a ferramenta mais poderosa.", decree: "Eu sou luz e minha presença transforma os ambientes por onde passo.", action: "Ao atender cada pessoa hoje, visualize luz envolvendo vocês dois." },
  { verse: "Tudo tem o seu tempo determinado.", ref: "Eclesiastes 3:1", reflection: "Respeitar o tempo é cocriar com sabedoria. Nem tudo precisa ser agora — o momento certo potencializa cada ação.", decree: "Eu respeito o tempo divino e confio que tudo chega na hora certa.", action: "Reorganize sua agenda priorizando o que realmente importa hoje." },
  { verse: "Vinde a mim, todos os que estais cansados.", ref: "Mateus 11:28", reflection: "Descansar é parte da cocriação. Você não produz mais quando se esgota — produz mais quando se renova.", decree: "Eu me permito descansar e sei que meu descanso é produtivo.", action: "Programe uma pausa real hoje, sem celular, por pelo menos 15 minutos." },
  { verse: "O Senhor abençoe e guarde vocês.", ref: "Números 6:24-25", reflection: "Abençoar é estender a cocriação para outros. Quando você abençoa, ativa uma corrente de bem que retorna multiplicada.", decree: "Eu abençoo cada pessoa que cruza meu caminho hoje.", action: "Ao encerrar cada atendimento, deseje algo genuinamente bom ao cliente." },
  { verse: "Peçam, e lhes será dado; busquem, e encontrarão.", ref: "Mateus 7:7", reflection: "Pedir é o primeiro ato da cocriação. Deus espera que você declare o que deseja para que Ele possa agir.", decree: "Eu peço com fé, busco com persistência e recebo com gratidão.", action: "Escreva um pedido específico a Deus e leia em voz alta." },
  { verse: "Todas as coisas cooperam para o bem.", ref: "Romanos 8:28", reflection: "Até os desafios são parte da cocriação. O que parece obstáculo é, na verdade, material de construção para algo maior.", decree: "Tudo coopera para o meu bem e eu transformo desafios em crescimento.", action: "Relembre um desafio recente e identifique o aprendizado que ele trouxe." },
  { verse: "Sejam bondosos e compassivos uns para com os outros.", ref: "Efésios 4:32", reflection: "A compaixão é a cola da cocriação coletiva. Quando você é bondoso, cria um campo de possibilidades para todos.", decree: "Eu sou bondoso e minha compaixão cria milagres ao meu redor.", action: "Pratique um ato de bondade inesperado com alguém hoje." },
  { verse: "Deleita-te no Senhor, e ele te concederá o que deseja o teu coração.", ref: "Salmos 37:4", reflection: "O deleite alinha seu coração com o coração de Deus. Na cocriação, quando seus desejos se alinham com o propósito divino, eles se manifestam.", decree: "Meus desejos estão alinhados com o propósito de Deus para minha vida.", action: "Medite por 3 minutos sobre o que seu coração verdadeiramente deseja." },
  { verse: "Onde estiver o vosso tesouro, aí estará o vosso coração.", ref: "Mateus 6:21", reflection: "Sua atenção determina sua realidade. Na cocriação, investir energia no que é verdadeiramente valioso multiplica seus resultados.", decree: "Eu invisto minha energia no que realmente importa e colho abundância.", action: "Revise onde está gastando mais tempo e redirecione para o que gera valor." },
  { verse: "A minha paz vos dou; não vo-la dou como o mundo a dá.", ref: "João 14:27", reflection: "A paz interior é a base da cocriação. Quando você está em paz, suas decisões são mais sábias e seus resultados mais consistentes.", decree: "A paz de Cristo habita em mim e guia todas as minhas decisões.", action: "Antes de uma decisão importante hoje, busque primeiro a paz interior." },
  { verse: "As suas misericórdias se renovam cada manhã.", ref: "Lamentações 3:23", reflection: "Cada dia é um novo início na cocriação. O passado não determina seu futuro — a misericórdia de Deus renova suas possibilidades.", decree: "Hoje é um novo começo e eu abraço todas as possibilidades deste dia.", action: "Solte algo do passado que está pesando e comece este dia limpo." },
  { verse: "Quem habita no abrigo do Altíssimo descansará.", ref: "Salmos 91:1", reflection: "Proteção e cocriação caminham juntas. Quando você se abriga em Deus, cria a partir de um lugar seguro.", decree: "Eu habito no abrigo do Altíssimo e de lá cocrío minha realidade.", action: "Declare proteção sobre seu trabalho, seus clientes e sua família." },
  { verse: "Eu sou a videira; vocês são os ramos.", ref: "João 15:5", reflection: "Permanecer conectado à fonte é o segredo da cocriação frutífera. Sem conexão, não há fruto sustentável.", decree: "Eu permaneço conectado a Deus e minha vida produz frutos abundantes.", action: "Encontre um momento hoje para orar e renovar sua conexão." },
  { verse: "Lança o teu pão sobre as águas.", ref: "Eclesiastes 11:1", reflection: "Semear sem garantia é fé em ação. Na cocriação, cada semente lançada com fé retorna multiplicada no tempo certo.", decree: "Eu semeio com fé e colho com alegria no tempo determinado.", action: "Invista em algo hoje sem esperar retorno imediato — pode ser tempo, conhecimento ou recurso." },
  { verse: "O coração do homem traça o seu caminho, mas o Senhor lhe dirige os passos.", ref: "Provérbios 16:9", reflection: "Planeje com sabedoria, mas permita que Deus ajuste a rota. A cocriação perfeita une seu planejamento com a direção divina.", decree: "Eu planejo com sabedoria e permito que Deus direcione meus passos.", action: "Revise seus planos do mês e pergunte: isso está alinhado com meu propósito?" },
  { verse: "Ensina-nos a contar os nossos dias.", ref: "Salmos 90:12", reflection: "Cada dia é precioso na cocriação. Quando você valoriza o tempo, transforma momentos comuns em extraordinários.", decree: "Eu valorizo cada dia e faço dele uma obra-prima de cocriação.", action: "Ao final do dia, registre uma vitória — por menor que seja." },
  { verse: "Transformem-se pela renovação da sua mente.", ref: "Romanos 12:2", reflection: "A mente renovada é a mente cocriadora. Quando você muda seus pensamentos, muda sua realidade.", decree: "Minha mente se renova diariamente e eu cocrío uma realidade extraordinária.", action: "Substitua um pensamento limitante por uma verdade bíblica hoje." },
  { verse: "O fruto do Espírito é amor, alegria, paz, paciência, amabilidade, bondade, fidelidade, mansidão e domínio próprio.", ref: "Gálatas 5:22-23", reflection: "Os frutos do Espírito são os sinais de uma cocriação saudável. Quando você cultiva esses frutos, tudo ao seu redor floresce.", decree: "Os frutos do Espírito se manifestam em mim e através de mim.", action: "Escolha um fruto do Espírito para cultivar intencionalmente hoje." },
  { verse: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.", ref: "Salmos 46:1", reflection: "Nos momentos difíceis, a cocriação não para — ela se fortalece. Deus é seu refúgio e de lá você cocriar com mais força.", decree: "Em toda angústia, Deus é meu refúgio e minha força se renova.", action: "Se estiver passando por um momento difícil, pare e busque refúgio na oração." },
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
        {/* Left: Upcoming appointments */}
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

          {/* Milagre da Cocriação */}
          {(() => {
            const devotion = getDailyDevotion();
            return (
              <div className={styles.verseCard}>
                <div className={styles.verseHeader}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                  </svg>
                  <h3 className={styles.cardTitle}>Milagre da Cocriação</h3>
                </div>
                <blockquote className={styles.verseText}>
                  &ldquo;{devotion.verse}&rdquo;
                </blockquote>
                <cite className={styles.verseRef}>{devotion.ref}</cite>
                <div className={styles.devotionSection}>
                  <h4 className={styles.devotionLabel}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/></svg>
                    Reflexão
                  </h4>
                  <p className={styles.devotionText}>{devotion.reflection}</p>
                </div>
                <div className={styles.devotionSection}>
                  <h4 className={styles.devotionLabel}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    Decreto
                  </h4>
                  <p className={styles.devotionDecree}>{devotion.decree}</p>
                </div>
                <div className={styles.devotionSection}>
                  <h4 className={styles.devotionLabel}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                    Ação do Dia
                  </h4>
                  <p className={styles.devotionText}>{devotion.action}</p>
                </div>
              </div>
            );
          })()}

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
