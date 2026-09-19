"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import styles from "./Dashboard.module.css";
import type { CalendarEvent } from "./CalendarView";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
  const parts = name.split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
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

const BORDER_COLORS: Record<string, string> = {
  constelacao: "#b8873a",
  consultoria_financeira: "#d9b268",
  planejamento: "#2f4a2b",
  reuniao: "#6b6152",
  bloqueio_pessoal: "#8a7f6a",
  evento_curso: "#1a2e18",
};

export function Dashboard({ userName, events, clients, onNavigate }: DashboardProps) {
  const [kpis, setKpis] = useState<KPIs | null>(null);

  const fetchKPIs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dashboard/kpis`, { credentials: "include" });
      if (res.ok) setKpis(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchKPIs(); }, [fetchKPIs]);

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

  return (
    <div className={styles.container}>
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

      {/* KPI Cards - Row 1 */}
      <div className={styles.statsRow}>
        <div className={`${styles.statCard} ${styles.statCardPrimary}`}>
          <div className={styles.statLabel}>HOJE</div>
          <div className={styles.statValue}>{todayEvents.length}</div>
          <div className={styles.statSub}>atendimentos</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>SEMANA</div>
          <div className={styles.statValue}>{kpis?.week.count ?? 0}</div>
          <div className={styles.statSub}>sessões</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>MÊS</div>
          <div className={styles.statValue}>
            {kpis?.month.appointments ?? 0}
            <TrendBadge value={monthTrend} />
          </div>
          <div className={styles.statSub}>
            {kpis ? `${kpis.month.completionRate}% concluídos` : "agendamentos"}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>NOVOS CLIENTES</div>
          <div className={styles.statValue}>{newClientsThisMonth}</div>
          <div className={styles.statSub}>
            {clients.length} total
          </div>
        </div>
      </div>

      {/* Financial Row */}
      <div className={styles.financeRow}>
        <button className={styles.financeCard} onClick={() => onNavigate("financeiro")} type="button">
          <div className={styles.financeIcon}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M10 2v16M6 6c0-1.1 1.8-2 4-2s4 .9 4 2-1.8 2-4 2-4 .9-4 2 1.8 2 4 2 4 .9 4 2" strokeLinecap="round" />
            </svg>
          </div>
          <div className={styles.financeInfo}>
            <div className={styles.financeLabel}>Recebido no mês</div>
            <div className={styles.financeValue}>
              {kpis ? formatCurrency(kpis.receivables.received) : "—"}
            </div>
          </div>
          {kpis && <TrendBadge value={kpis.revenue.trend} />}
        </button>
        <button className={styles.financeCard} onClick={() => onNavigate("financeiro")} type="button">
          <div className={`${styles.financeIcon} ${styles.financeIconWarning}`}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="10" cy="10" r="8" />
              <path d="M10 6v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className={styles.financeInfo}>
            <div className={styles.financeLabel}>A receber</div>
            <div className={styles.financeValue}>
              {kpis ? formatCurrency(kpis.receivables.pending) : "—"}
            </div>
          </div>
          {kpis && kpis.receivables.pendingCount > 0 && (
            <span className={styles.financeCount}>{kpis.receivables.pendingCount}</span>
          )}
        </button>
        <button
          className={`${styles.financeCard} ${kpis && kpis.receivables.overdueCount > 0 ? styles.financeCardAlert : ""}`}
          onClick={() => onNavigate("financeiro")}
          type="button"
        >
          <div className={`${styles.financeIcon} ${styles.financeIconDanger}`}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M10 2L2 18h16L10 2z" strokeLinejoin="round" />
              <line x1="10" y1="8" x2="10" y2="12" strokeLinecap="round" />
              <circle cx="10" cy="15" r="0.5" fill="currentColor" />
            </svg>
          </div>
          <div className={styles.financeInfo}>
            <div className={styles.financeLabel}>Em atraso</div>
            <div className={`${styles.financeValue} ${kpis && kpis.receivables.overdueCount > 0 ? styles.financeValueDanger : ""}`}>
              {kpis ? formatCurrency(kpis.receivables.overdue) : "—"}
            </div>
          </div>
          {kpis && kpis.receivables.overdueCount > 0 && (
            <span className={`${styles.financeCount} ${styles.financeCountDanger}`}>{kpis.receivables.overdueCount}</span>
          )}
        </button>
        <button className={styles.financeCard} onClick={() => onNavigate("vendas")} type="button">
          <div className={`${styles.financeIcon} ${styles.financeIconSuccess}`}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 14l4-4 4 3 3-5 5 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className={styles.financeInfo}>
            <div className={styles.financeLabel}>Vendas no mês</div>
            <div className={styles.financeValue}>
              {kpis ? formatCurrency(kpis.revenue.thisMonth) : "—"}
            </div>
          </div>
        </button>
      </div>

      {/* Main grid */}
      <div className={styles.mainGrid}>
        {/* Left: Upcoming appointments */}
        <div className={styles.clientsCard}>
          <div className={styles.clientsHeader}>
            <h2 className={styles.clientsTitle}>Próximos atendimentos</h2>
            <button className={styles.viewAllBtn} onClick={() => onNavigate("agenda")} type="button">
              Ver agenda →
            </button>
          </div>

          {(!kpis || kpis.upcoming.length === 0) ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📅</div>
              <div className={styles.emptyText}>Nenhum atendimento agendado</div>
              <button className={styles.emptyBtn} onClick={() => onNavigate("agenda")} type="button">
                Abrir agenda
              </button>
            </div>
          ) : (
            kpis.upcoming.map((appt) => (
              <div key={appt.id} className={styles.upcomingItem} onClick={() => onNavigate("agenda")}>
                <div
                  className={styles.upcomingBar}
                  style={{ background: BORDER_COLORS[appt.type] || "#b8873a" }}
                />
                <div className={styles.upcomingInfo}>
                  <div className={styles.upcomingName}>
                    {appt.clientName || appt.title.split(" — ")[0]}
                  </div>
                  <div className={styles.upcomingSub}>
                    {appt.title.includes(" — ") ? appt.title.split(" — ")[0] : appt.type}
                  </div>
                </div>
                <div className={styles.upcomingTime}>
                  <div className={styles.upcomingDate}>{formatShortDate(appt.startTime)}</div>
                  <div className={styles.upcomingHour}>{formatTime(appt.startTime)}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right column */}
        <div className={styles.rightColumn}>
          {/* Today schedule */}
          <div className={styles.todayCard}>
            <h2 className={styles.todayTitle}>Hoje</h2>
            {todayEvents.slice(0, 5).map((e) => (
              <div
                key={e.id}
                className={styles.todayItem}
                style={{ borderLeftColor: BORDER_COLORS[e.type] || "#b8873a" }}
              >
                <div className={styles.todayItemName}>
                  {e.clientName || e.title.split(" — ")[0]} · <span className={styles.todayItemTime}>{formatTime(e.startDate)}</span>
                </div>
                <div className={styles.todayItemSub}>
                  {e.status === "concluido" ? "✓ Concluído" : e.status === "cancelado" ? "✗ Cancelado" : e.type}
                </div>
              </div>
            ))}
            {todayEvents.length === 0 && (
              <div className={styles.todayItemSub} style={{ padding: "12px 0", textAlign: "center" }}>
                Nenhum compromisso hoje
              </div>
            )}
          </div>

          {/* Quick insights */}
          {kpis && (kpis.month.cancelled > 0 || kpis.receivables.overdueCount > 0 || newClientsThisMonth > 0) && (
            <div className={styles.insightsCard}>
              <h3 className={styles.insightsTitle}>Insights</h3>
              {kpis.receivables.overdueCount > 0 && (
                <div className={styles.insightItem}>
                  <span className={`${styles.insightDot} ${styles.insightDotDanger}`} />
                  <span>{kpis.receivables.overdueCount} cobranças em atraso ({formatCurrency(kpis.receivables.overdue)})</span>
                </div>
              )}
              {kpis.month.cancelled > 0 && (
                <div className={styles.insightItem}>
                  <span className={`${styles.insightDot} ${styles.insightDotWarning}`} />
                  <span>{kpis.month.cancelled} cancelamentos este mês</span>
                </div>
              )}
              {newClientsThisMonth > 0 && (
                <div className={styles.insightItem}>
                  <span className={`${styles.insightDot} ${styles.insightDotSuccess}`} />
                  <span>{newClientsThisMonth} {newClientsThisMonth === 1 ? "novo cliente" : "novos clientes"} este mês</span>
                </div>
              )}
              {kpis.month.completionRate >= 80 && (
                <div className={styles.insightItem}>
                  <span className={`${styles.insightDot} ${styles.insightDotSuccess}`} />
                  <span>Taxa de conclusão excelente: {kpis.month.completionRate}%</span>
                </div>
              )}
            </div>
          )}

          {/* Clients summary */}
          <div className={styles.clientsSummary}>
            <div className={styles.clientsSummaryHeader}>
              <h3 className={styles.insightsTitle}>Clientes</h3>
              <button className={styles.viewAllBtn} onClick={() => onNavigate("clientes")} type="button">
                Ver todos →
              </button>
            </div>
            {clients.slice(0, 4).map((c) => (
              <div key={c.id} className={styles.clientMini} onClick={() => onNavigate("clientes")}>
                <div className={styles.clientAvatar}>
                  <span className={styles.clientInitials}>{getInitials(c.name)}</span>
                </div>
                <div className={styles.clientMiniInfo}>
                  <div className={styles.clientName}>{c.name}</div>
                  <div className={styles.clientMiniSub}>{c.sessions ?? 0} sessões · última {c.lastDate || "—"}</div>
                </div>
                {c.isNew && <span className={styles.newBadge}>NOVO</span>}
              </div>
            ))}
            {clients.length === 0 && (
              <div className={styles.todayItemSub} style={{ padding: "12px 0", textAlign: "center" }}>
                Nenhum cliente cadastrado
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
