"use client";

import { useState, useMemo } from "react";
import styles from "./Dashboard.module.css";
import type { CalendarEvent } from "./CalendarView";

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

function getInitials(name: string) {
  const parts = name.split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Cuiaba",
  });
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
  const [filter, setFilter] = useState<"todos" | "ativos" | "novos">("todos");

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

  const weekEvents = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    return events.filter((e) => {
      const d = new Date(e.startDate);
      return d >= startOfWeek && d < endOfWeek;
    });
  }, [events]);

  const filteredClients = useMemo(() => {
    if (filter === "novos") return clients.filter((c) => c.isNew);
    if (filter === "ativos") return clients.filter((c) => (c.sessions || 0) > 0);
    return clients;
  }, [clients, filter]);

  const newClientsThisMonth = useMemo(
    () => clients.filter((c) => c.isNew).length,
    [clients]
  );

  const freeSlot = useMemo(() => {
    if (todayEvents.length === 0) return null;
    const last = todayEvents[todayEvents.length - 1];
    const lastEnd = new Date(last.endDate);
    const eod = new Date(lastEnd);
    eod.setHours(17, 0, 0, 0);
    if (lastEnd < eod) {
      return {
        start: formatTime(last.endDate),
        end: "17:00",
      };
    }
    return null;
  }, [todayEvents]);

  const newClient = clients.find((c) => c.isNew);

  function getSubtitle(e: CalendarEvent) {
    const typeMap: Record<string, string> = {
      constelacao: "Sessão · presencial",
      consultoria_financeira: "Sessão · online",
      planejamento: "Planejamento",
      reuniao: "Reunião",
      evento_curso: "",
    };
    if (e.type === "evento_curso" && e.title.includes("Círculo")) {
      return "6 pessoas";
    }
    return typeMap[e.type] || e.type;
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.greeting}>
          <div className={styles.dateLabel}>{formatDateLabel()}</div>
          <h1 className={styles.hello}>
            {getGreeting()}, <span className={styles.helloName}>{userName || "Fabiana"}</span>
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

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={`${styles.statCard} ${styles.statCardPrimary}`}>
          <div className={styles.statLabel}>HOJE</div>
          <div className={styles.statValue}>{todayEvents.length}</div>
          <div className={styles.statSub}>atendimentos</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>SEMANA</div>
          <div className={styles.statValue}>{weekEvents.length}</div>
          <div className={styles.statSub}>sessões</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>NOVOS CLIENTES</div>
          <div className={styles.statValue}>{newClientsThisMonth}</div>
          <div className={styles.statSub}>este mês</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>TOTAL DE CLIENTES</div>
          <div className={styles.statValue}>{clients.length}</div>
          <div className={styles.statSub}>cadastrados</div>
        </div>
      </div>

      {/* Main grid */}
      <div className={styles.mainGrid}>
        {/* Left: Clients table */}
        <div className={styles.clientsCard}>
          <div className={styles.clientsHeader}>
            <h2 className={styles.clientsTitle}>Clientes recentes</h2>
            <div className={styles.filterTabs}>
              {(["todos", "ativos", "novos"] as const).map((f) => (
                <button
                  key={f}
                  className={`${styles.filterTab} ${filter === f ? styles.filterTabActive : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.tableHeader}>
            <span className={styles.tableHeaderCell}>NOME</span>
            <span className={styles.tableHeaderCell}>ORIGEM</span>
            <span className={`${styles.tableHeaderCell} ${styles.cellCenter}`}>SESSÕES</span>
            <span className={styles.tableHeaderCell}>ÚLTIMA</span>
            <span />
          </div>

          {filteredClients.length === 0 ? (
            <div
              className={styles.cellText}
              style={{ padding: "24px 0", textAlign: "center" }}
            >
              {clients.length === 0
                ? "Nenhum cliente cadastrado ainda."
                : "Nenhum cliente neste filtro."}
            </div>
          ) : (
            filteredClients.slice(0, 5).map((client) => (
              <div key={client.id} className={styles.tableRow} onClick={() => onNavigate("clientes")}>
                <div className={styles.clientCell}>
                  <div className={styles.clientAvatar}>
                    <span className={styles.clientInitials}>{getInitials(client.name)}</span>
                  </div>
                  <span className={styles.clientName}>
                    {client.name}
                    {client.isNew && <span className={styles.newBadge}>NOVA</span>}
                  </span>
                </div>
                <span className={styles.cellText}>{client.origin || "—"}</span>
                <span className={`${styles.cellText} ${styles.cellCenter}`}>{client.sessions ?? 0}</span>
                <span className={styles.cellText}>{client.lastDate || "—"}</span>
                <span className={styles.chevron}>›</span>
              </div>
            ))
          )}
        </div>

        {/* Right column */}
        <div className={styles.rightColumn}>
          {/* Today schedule */}
          <div className={styles.todayCard}>
            <h2 className={styles.todayTitle}>Hoje</h2>
            {todayEvents.slice(0, 4).map((e) => (
              <div
                key={e.id}
                className={styles.todayItem}
                style={{ borderLeftColor: BORDER_COLORS[e.type] || "#b8873a" }}
              >
                <div className={styles.todayItemName}>
                  {e.clientName || e.title.split(" — ")[0]} · <span className={styles.todayItemTime}>{formatTime(e.startDate)}</span>
                </div>
                <div className={styles.todayItemSub}>{getSubtitle(e)}</div>
              </div>
            ))}
            {todayEvents.length === 0 && (
              <div className={styles.todayItemSub} style={{ padding: "12px 0", textAlign: "center" }}>
                Nenhum compromisso hoje
              </div>
            )}
          </div>

          {/* Assistant suggestion */}
          <div className={styles.assistantCard}>
            <div className={styles.assistantHeader}>
              <div className={styles.assistantIcon}>✦</div>
              <span className={styles.assistantLabel}>ASSISTENTE</span>
            </div>
            <p className={styles.assistantText}>
              {freeSlot ? (
                <>
                  Você tem uma janela livre <span className={styles.assistantBold}>{freeSlot.start} — {freeSlot.end}</span>.
                  {newClient ? (
                    <> Quer que eu ofereça esse horário à {newClient.name} (nova cliente)?</>
                  ) : (
                    <> Quer que eu sugira um horário para um novo atendimento?</>
                  )}
                </>
              ) : (
                <>Sua agenda de hoje está completa. Quer que eu organize os próximos dias?</>
              )}
            </p>
            <div className={styles.assistantActions}>
              <button className={styles.assistantBtnPrimary} onClick={() => onNavigate("assistente")}>
                {freeSlot ? "Ofereça" : "Organizar"}
              </button>
              <button className={styles.assistantBtnSecondary}>Depois</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
