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

function getDayProgress() {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  return Math.min(100, Math.max(0, ((h - 7) / 14) * 100));
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

  const timeUntilNext = useMemo(() => getTimeUntilNext(todayEvents), [todayEvents]);
  const dayProgress = getDayProgress();
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
          {/* Today timeline */}
          <div className={styles.todayCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Sua agenda hoje</h2>
              {todayEvents.length > 0 && (
                <span className={styles.todayCount}>{todayEvents.length}</span>
              )}
            </div>

            {todayEvents.length === 0 ? (
              <div className={styles.todayEmpty}>
                <div className={styles.todayEmptyText}>Dia livre</div>
                <button className={styles.todayEmptyBtn} onClick={() => onNavigate("agenda")} type="button">
                  Ver agenda da semana →
                </button>
              </div>
            ) : (
              <>
                <div className={styles.dayProgressWrap}>
                  <div className={styles.dayProgressBar}>
                    <div className={styles.dayProgressFill} style={{ width: `${dayProgress}%` }} />
                  </div>
                  <span className={styles.dayProgressLabel}>
                    {timeUntilNext ? `Próximo ${timeUntilNext}` : "Concluído"}
                  </span>
                </div>
                <div className={styles.timeline}>
                  {todayEvents.slice(0, 6).map((e) => {
                    const isPast = new Date(e.endDate) < new Date();
                    const isCurrent = new Date(e.startDate) <= new Date() && new Date(e.endDate) >= new Date();
                    return (
                      <div
                        key={e.id}
                        className={`${styles.timelineItem} ${isPast ? styles.timelineItemPast : ""} ${isCurrent ? styles.timelineItemCurrent : ""}`}
                      >
                        <div
                          className={styles.timelineDot}
                          style={{ borderColor: BORDER_COLORS[e.type] || "#b8873a" }}
                        />
                        <div className={styles.timelineContent}>
                          <span className={styles.timelineTime}>{formatTime(e.startDate)}</span>
                          <span className={styles.timelineName}>
                            {e.clientName || e.title.split(" — ")[0]}
                          </span>
                        </div>
                        {e.status === "concluido" && <span className={styles.timelineDone}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Actionable Insights / Alerts */}
          {kpis && (kpis.receivables.overdueCount > 0 || kpis.month.cancelled > 0 || newClientsThisMonth > 0 || (kpis.month.completionRate >= 80 && kpis.month.completed > 0)) && (
            <div className={styles.insightsCard}>
              <h3 className={styles.cardTitle}>Alertas e destaques</h3>
              <div className={styles.insightsList}>
                {kpis.receivables.overdueCount > 0 && (
                  <button className={`${styles.insightItem} ${styles.insightItemDanger}`} onClick={() => onNavigate("financeiro")} type="button">
                    <span className={`${styles.insightIcon} ${styles.insightIconDanger}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </span>
                    <div className={styles.insightText}>
                      <strong>{kpis.receivables.overdueCount} cobranças em atraso</strong>
                      <span>{formatCurrency(kpis.receivables.overdue)}</span>
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
                {kpis.month.completionRate >= 80 && kpis.month.completed > 0 && (
                  <button className={`${styles.insightItem} ${styles.insightItemSuccess}`} onClick={() => onNavigate("dashboards")} type="button">
                    <span className={`${styles.insightIcon} ${styles.insightIconSuccess}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20V10M18 20V4M6 20v-4" />
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
