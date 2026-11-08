"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import styles from "./DashboardsView.module.css";

type TabId = "financeiro" | "operacional" | "vendas";
type RangeId = "this_month" | "last_month" | "last_3_months" | "custom";

interface AnalyticsData {
  range: { start: string; end: string };
  financial: {
    revenueRealized: number;
    revenueProjected: number;
    prevRevenue: number;
    revenueTrend: number;
    overdueTotal: number;
    overdueCount: number;
    delinquencyRate: number;
    avgTicket: number;
    revenueByMonth: Record<string, number>;
  };
  operational: {
    totalAppointments: number;
    completed: number;
    cancelled: number;
    noShow: number;
    occupancyRate: number;
    prevTotalAppointments: number;
    trend: number;
    apptsByMonth: Record<string, { completed: number; cancelled: number; total: number }>;
    apptsByType: Record<string, number>;
    minutesByType: Record<string, number>;
  };
  sales: {
    totalBookingRequests: number;
    approvedBookings: number;
    bookingConversion: number;
    contractsGenerated: number;
    contractsSigned: number;
    newClients: number;
    prevNewClients: number;
    clientsTrend: number;
    totalSales: number;
    salesRevenue: number;
  };
}

const RANGE_LABELS: Record<RangeId, string> = {
  this_month: "Este mês",
  last_month: "Mês passado",
  last_3_months: "Últimos 3 meses",
  custom: "Personalizado",
};

const TAB_LABELS: Record<TabId, string> = {
  financeiro: "Financeiro",
  operacional: "Operacional",
  vendas: "Vendas",
};

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function TrendBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const cls = value > 0 ? styles.kpiTrendUp : styles.kpiTrendDown;
  return <span className={cls}>{value > 0 ? "+" : ""}{value}%</span>;
}

function monthLabel(ym: string): string {
  const [, m] = ym.split("-");
  return MONTH_NAMES[parseInt(m, 10) - 1] || ym;
}

function SimpleBarChart({ data, formatValue }: { data: { label: string; value: number; secondary?: number }[]; formatValue?: (v: number) => string }) {
  const max = Math.max(...data.map((d) => Math.max(d.value, d.secondary || 0)), 1);
  const fmt = formatValue || ((v: number) => String(v));
  return (
    <div className={styles.barChart}>
      {data.map((d) => (
        <div key={d.label} className={styles.barGroup}>
          <span className={styles.barValue}>{fmt(d.value)}</span>
          <div className={styles.bar} style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} />
          {d.secondary !== undefined && (
            <div className={`${styles.bar} ${styles.barSecondary}`} style={{ height: `${Math.max(2, (d.secondary / max) * 100)}%` }} />
          )}
          <span className={styles.barLabel}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ segments, size = 120 }: { segments: { label: string; value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div className={styles.empty}>Sem dados</div>;
  const r = size / 2 - 8;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className={styles.donutWrap}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg) => {
          const pct = seg.value / total;
          const dash = circ * pct;
          const gap = circ - dash;
          const el = (
            <circle
              key={seg.label}
              cx={c} cy={c} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={14}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              style={{ transition: "stroke-dasharray 0.4s, stroke-dashoffset 0.4s" }}
            />
          );
          offset += dash;
          return el;
        })}
        <text x={c} y={c} textAnchor="middle" dominantBaseline="central" fill="var(--primary)" fontFamily="var(--font-heading)" fontSize="1.3rem">
          {total}
        </text>
      </svg>
      <div className={styles.donutLegend}>
        {segments.map((seg) => (
          <div key={seg.label} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: seg.color }} />
            {seg.label}
            <span className={styles.legendValue}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

import { getEventTypeLabel, getEventTypeColor } from "@/lib/event-types";

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}min`;
}

function TypeBreakdownChart({ data, total }: { data: { type: string; count: number; minutes: number }[]; total: number }) {
  if (data.length === 0 || total === 0) {
    return <div className={styles.empty}>Sem dados no período</div>;
  }
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className={styles.typeBreakdown}>
      {data.map((d) => {
        const pct = Math.round((d.count / total) * 100);
        const color = getEventTypeColor(d.type);
        return (
          <div key={d.type} className={styles.typeRow}>
            <div className={styles.typeLabel}>
              <span className={styles.typeDot} style={{ background: color }} />
              <span className={styles.typeName}>{getEventTypeLabel(d.type)}</span>
            </div>
            <div className={styles.typeBarWrap}>
              <div className={styles.typeBar} style={{ width: `${Math.max(3, (d.count / maxCount) * 100)}%`, background: color }} />
            </div>
            <div className={styles.typeStats}>
              <span className={styles.typeCount}>{d.count}</span>
              <span className={styles.typePct}>{pct}%</span>
              <span className={styles.typeDuration}>{formatDuration(d.minutes)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FinancialTab({ data }: { data: AnalyticsData }) {
  const { financial } = data;
  const months = Object.entries(financial.revenueByMonth).sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Faturamento Realizado</div>
          <div className={styles.kpiValue}>{formatCurrency(financial.revenueRealized)}</div>
          <div className={styles.kpiSub}>vs período anterior <TrendBadge value={financial.revenueTrend} /></div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Faturamento Previsto</div>
          <div className={styles.kpiValue}>{formatCurrency(financial.revenueProjected)}</div>
          <div className={styles.kpiSub}>{Math.round((financial.revenueRealized / Math.max(financial.revenueProjected, 1)) * 100)}% realizado</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Ticket Médio</div>
          <div className={styles.kpiValue}>{formatCurrency(financial.avgTicket)}</div>
          <div className={styles.kpiSub}>por venda no período</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Inadimplência</div>
          <div className={`${styles.kpiValue} ${financial.delinquencyRate > 10 ? styles.kpiValueDanger : ""}`}>{financial.delinquencyRate}%</div>
          <div className={styles.kpiSub}>{formatCurrency(financial.overdueTotal)} em atraso ({financial.overdueCount})</div>
        </div>
      </div>

      <div className={styles.chartsRow}>
        <div className={`${styles.chartCard} ${styles.fullWidthChart}`}>
          <div className={styles.chartTitle}>Faturamento por Mês</div>
          {months.length > 0 ? (
            <SimpleBarChart
              data={months.map(([m, v]) => ({ label: monthLabel(m), value: v }))}
              formatValue={(v) => formatCurrency(v)}
            />
          ) : (
            <div className={styles.empty}>Sem dados no período</div>
          )}
        </div>
      </div>

      <div className={styles.chartCard}>
        <div className={styles.chartTitle}>Fluxo de Caixa</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "24px", flexWrap: "wrap" }}>
          <div>
            <div className={styles.kpiLabel}>Realizado</div>
            <div style={{ fontSize: "1.4rem", fontFamily: "var(--font-heading)", color: "var(--primary)" }}>{formatCurrency(financial.revenueRealized)}</div>
          </div>
          <div>
            <div className={styles.kpiLabel}>Previsto</div>
            <div style={{ fontSize: "1.4rem", fontFamily: "var(--font-heading)", color: "var(--text-muted)" }}>{formatCurrency(financial.revenueProjected)}</div>
          </div>
          <div>
            <div className={styles.kpiLabel}>Em Atraso</div>
            <div style={{ fontSize: "1.4rem", fontFamily: "var(--font-heading)", color: "#c04a2a" }}>{formatCurrency(financial.overdueTotal)}</div>
          </div>
        </div>
        <div className={styles.progressBarWrap}>
          <div
            className={styles.progressBar}
            style={{ width: `${Math.min(100, Math.round((financial.revenueRealized / Math.max(financial.revenueProjected, 1)) * 100))}%` }}
          />
        </div>
      </div>
    </>
  );
}

function OperationalTab({ data }: { data: AnalyticsData }) {
  const { operational } = data;
  const months = Object.entries(operational.apptsByMonth).sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Taxa de Ocupação</div>
          <div className={`${styles.kpiValue} ${operational.occupancyRate >= 70 ? styles.kpiValueGood : ""}`}>{operational.occupancyRate}%</div>
          <div className={styles.kpiSub}>da agenda preenchida</div>
          <div className={styles.progressBarWrap}>
            <div className={styles.progressBar} style={{ width: `${operational.occupancyRate}%` }} />
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total de Sessões</div>
          <div className={styles.kpiValue}>{operational.totalAppointments}</div>
          <div className={styles.kpiSub}>vs anterior <TrendBadge value={operational.trend} /></div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Concluídas</div>
          <div className={`${styles.kpiValue} ${styles.kpiValueGood}`}>{operational.completed}</div>
          <div className={styles.kpiSub}>
            {operational.totalAppointments > 0 ? Math.round((operational.completed / operational.totalAppointments) * 100) : 0}% do total
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Canceladas / Faltas</div>
          <div className={`${styles.kpiValue} ${styles.kpiValueDanger}`}>{operational.cancelled + operational.noShow}</div>
          <div className={styles.kpiSub}>{operational.cancelled} canceladas · {operational.noShow} faltas</div>
        </div>
      </div>

      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Sessões por Mês</div>
          {months.length > 0 ? (
            <SimpleBarChart
              data={months.map(([m, v]) => ({ label: monthLabel(m), value: v.completed, secondary: v.cancelled }))}
            />
          ) : (
            <div className={styles.empty}>Sem dados no período</div>
          )}
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Status das Sessões</div>
          <DonutChart segments={[
            { label: "Concluídas", value: operational.completed, color: "#4a7a3e" },
            { label: "Canceladas", value: operational.cancelled, color: "#c04a2a" },
            { label: "Faltas", value: operational.noShow, color: "#b8873a" },
            { label: "Outras", value: Math.max(0, operational.totalAppointments - operational.completed - operational.cancelled - operational.noShow), color: "rgba(184,135,58,0.25)" },
          ]} />
        </div>
      </div>

      <div className={styles.chartsRow}>
        <div className={`${styles.chartCard} ${styles.fullWidthChart}`}>
          <div className={styles.chartTitle}>Atendimentos por Tipo de Evento</div>
          {(() => {
            const byType = operational.apptsByType || {};
            const minsByType = operational.minutesByType || {};
            const entries = Object.entries(byType)
              .map(([type, count]) => ({ type, count, minutes: minsByType[type] || 0 }))
              .sort((a, b) => b.count - a.count);
            return <TypeBreakdownChart data={entries} total={operational.totalAppointments} />;
          })()}
        </div>
      </div>
    </>
  );
}

function SalesTab({ data }: { data: AnalyticsData }) {
  const { sales } = data;

  return (
    <>
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Agendamentos Online</div>
          <div className={styles.kpiValue}>{sales.totalBookingRequests}</div>
          <div className={styles.kpiSub}>{sales.bookingConversion}% convertidos</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Contratos</div>
          <div className={styles.kpiValue}>{sales.contractsGenerated}</div>
          <div className={styles.kpiSub}>{sales.contractsSigned} assinados (ZapSign)</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Novos Clientes</div>
          <div className={styles.kpiValue}>{sales.newClients}</div>
          <div className={styles.kpiSub}>vs anterior <TrendBadge value={sales.clientsTrend} /></div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Vendas no Período</div>
          <div className={styles.kpiValue}>{sales.totalSales}</div>
          <div className={styles.kpiSub}>{formatCurrency(sales.salesRevenue)} total</div>
        </div>
      </div>

      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Funil de Conversão</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { label: "Solicitações de Agendamento", value: sales.totalBookingRequests, color: "var(--primary)" },
              { label: "Aprovados", value: sales.approvedBookings, color: "#4a7a3e" },
              { label: "Vendas Registradas", value: sales.totalSales, color: "var(--secondary, #b8873a)" },
              { label: "Contratos Gerados", value: sales.contractsGenerated, color: "#6b8f5e" },
              { label: "Contratos Assinados", value: sales.contractsSigned, color: "#3f6635" },
            ].map((step) => {
              const maxVal = Math.max(sales.totalBookingRequests, sales.totalSales, 1);
              return (
                <div key={step.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                    <span style={{ color: "var(--text)" }}>{step.label}</span>
                    <span style={{ fontWeight: 600, color: "var(--primary)" }}>{step.value}</span>
                  </div>
                  <div className={styles.progressBarWrap}>
                    <div className={styles.progressBar} style={{ width: `${Math.max(2, (step.value / maxVal) * 100)}%`, background: step.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Distribuição de Contratos</div>
          <DonutChart segments={[
            { label: "Assinados", value: sales.contractsSigned, color: "#4a7a3e" },
            { label: "Aguardando", value: Math.max(0, sales.contractsGenerated - sales.contractsSigned), color: "#b8873a" },
          ]} />
        </div>
      </div>
    </>
  );
}

export default function DashboardsView() {
  const [tab, setTab] = useState<TabId>("financeiro");
  const [range, setRange] = useState<RangeId>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ range });
      if (range === "custom" && customFrom) params.set("from", customFrom);
      if (range === "custom" && customTo) params.set("to", customTo);
      const res = await apiFetch(`/dashboard/analytics?${params}`);
      if (res.ok) setData(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  }, [range, customFrom, customTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className={`main-scrollable ${styles.container}`}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboards</h1>
          <p className={styles.subtitle}>Análise detalhada do seu negócio</p>
        </div>
        <div className={styles.filters}>
          <select
            className={styles.filterSelect}
            value={range}
            onChange={(e) => setRange(e.target.value as RangeId)}
          >
            {Object.entries(RANGE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {range === "custom" && (
            <>
              <input
                type="date"
                className={styles.filterInput}
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <input
                type="date"
                className={styles.filterInput}
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </>
          )}
        </div>
      </div>

      <div className={styles.tabs}>
        {(Object.keys(TAB_LABELS) as TabId[]).map((t) => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}>Carregando dados...</div>
      ) : !data ? (
        <div className={styles.empty}>Não foi possível carregar os dados.</div>
      ) : (
        <>
          {tab === "financeiro" && <FinancialTab data={data} />}
          {tab === "operacional" && <OperationalTab data={data} />}
          {tab === "vendas" && <SalesTab data={data} />}
        </>
      )}
    </div>
  );
}
