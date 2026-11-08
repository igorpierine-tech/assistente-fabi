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

function QuickActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className={styles.quickActionBtn} onClick={onClick} type="button">
      {label}
    </button>
  );
}

export function Dashboard({ userName, events, clients, onNavigate }: DashboardProps) {
  const [kpis, setKpis] = useState<KPIs | null>(null);

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

      {/* Consolidated KPI strip */}
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
          <div className={styles.statLabel}>RECEBIDO</div>
          <div className={styles.statValue} style={{ fontSize: "1.6rem" }}>
            {kpis ? formatCurrency(kpis.receivables.received) : "—"}
          </div>
          <div className={styles.statSub}>
            {kpis && kpis.revenue.trend !== 0 && <TrendBadge value={kpis.revenue.trend} />}
            {kpis ? " no mês" : "no mês"}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            {kpis && kpis.receivables.overdueCount > 0 ? "EM ATRASO" : "A RECEBER"}
          </div>
          <div className={`${styles.statValue} ${kpis && kpis.receivables.overdueCount > 0 ? styles.statValueDanger : ""}`}
            style={{ fontSize: "1.6rem" }}>
            {kpis
              ? formatCurrency(kpis.receivables.overdueCount > 0 ? kpis.receivables.overdue : kpis.receivables.pending)
              : "—"}
          </div>
          <div className={styles.statSub}>
            {kpis && kpis.receivables.overdueCount > 0
              ? `${kpis.receivables.overdueCount} cobranças`
              : kpis ? `${kpis.receivables.pendingCount} pendentes` : "pendentes"}
          </div>
        </div>
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
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                <rect x="3" y="4" width="18" height="17" rx="2" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="16" y1="2" x2="16" y2="6" />
              </svg>
              <div className={styles.emptyText}>Nenhum atendimento agendado</div>
              <div className={styles.emptySubtext}>Aproveite para organizar sua semana</div>
              <div className={styles.emptyActions}>
                <QuickActionBtn label="Ver agenda da semana" onClick={() => onNavigate("agenda")} />
                <QuickActionBtn label="Cadastrar cliente" onClick={() => onNavigate("clientes")} />
                <QuickActionBtn label="Novo serviço" onClick={() => onNavigate("produtos")} />
              </div>
            </div>
          ) : (
            kpis.upcoming.map((appt) => (
              <div key={appt.id} className={styles.upcomingItem}>
                <div
                  className={styles.upcomingBar}
                  style={{ background: BORDER_COLORS[appt.type] || "#b8873a" }}
                />
                <div className={styles.upcomingInfo} onClick={() => onNavigate("agenda")}>
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
                <div className={styles.upcomingActions}>
                  <button
                    className={styles.upcomingActionBtn}
                    onClick={() => handleMarkCompleted(appt.id)}
                    title="Marcar como concluído"
                    type="button"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </button>
                  <button
                    className={styles.upcomingActionBtn}
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
            ))
          )}
        </div>

        {/* Right column */}
        <div className={styles.rightColumn}>
          {/* Today schedule */}
          <div className={styles.todayCard}>
            <h2 className={styles.todayTitle}>Hoje</h2>
            {todayEvents.length === 0 ? (
              <div className={styles.todayEmpty}>
                <div className={styles.todayEmptyText}>Nenhum compromisso hoje</div>
                <button className={styles.todayEmptyBtn} onClick={() => onNavigate("agenda")} type="button">
                  Ver agenda da semana →
                </button>
              </div>
            ) : (
              todayEvents.slice(0, 5).map((e) => (
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
              ))
            )}
          </div>

          {/* Quick insights */}
          {kpis && (kpis.month.cancelled > 0 || kpis.receivables.overdueCount > 0 || newClientsThisMonth > 0) && (
            <div className={styles.insightsCard}>
              <h3 className={styles.insightsTitle}>Insights</h3>
              {kpis.receivables.overdueCount > 0 && (
                <div className={styles.insightItem} onClick={() => onNavigate("financeiro")} style={{ cursor: "pointer" }}>
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
                <div className={styles.insightItem} onClick={() => onNavigate("clientes")} style={{ cursor: "pointer" }}>
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

          {/* Quick actions */}
          <div className={styles.quickActionsCard}>
            <h3 className={styles.insightsTitle}>Atalhos rápidos</h3>
            <div className={styles.quickActionsGrid}>
              <button className={styles.quickAction} onClick={() => onNavigate("agenda")} type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="17" rx="2" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <line x1="12" y1="14" x2="12" y2="18" />
                  <line x1="10" y1="16" x2="14" y2="16" />
                </svg>
                <span>Nova sessão</span>
              </button>
              <button className={styles.quickAction} onClick={() => onNavigate("clientes")} type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="7" r="4" />
                  <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
                <span>Novo cliente</span>
              </button>
              <button className={styles.quickAction} onClick={() => onNavigate("financeiro")} type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                </svg>
                <span>Financeiro</span>
              </button>
              <button className={styles.quickAction} onClick={() => onNavigate("dashboards")} type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
