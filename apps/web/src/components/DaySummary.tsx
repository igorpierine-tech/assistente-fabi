"use client";

import { useState, useEffect } from "react";
import styles from "./DaySummary.module.css";
import type { CalendarEvent } from "./CalendarView";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface DaySummaryProps {
  userId: string;
  isDemo?: boolean;
  events?: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

interface Event {
  id: string;
  title: string;
  type: string;
  start: string;
  end: string;
}

interface EarlyWin {
  wins: string[];
}

function getDemoEvents(dateStr: string): Event[] {
  const base = [
    { id: "1", title: "Constelação — Maria Valentina", type: "constelacao", startH: 9, startM: 0, durMin: 90 },
    { id: "2", title: "Consultoria Financeira — Ana Paula", type: "consultoria", startH: 11, startM: 0, durMin: 60 },
    { id: "3", title: "Planejamento — Masterday Agosto", type: "planejamento", startH: 14, startM: 0, durMin: 60 },
    { id: "4", title: "Constelação — Juliana Costa", type: "constelacao", startH: 15, startM: 30, durMin: 90 },
    { id: "5", title: "Reunião — Raízes e Riquezas", type: "reuniao", startH: 17, startM: 30, durMin: 30 },
  ];

  return base.map((e) => {
    const start = new Date(`${dateStr}T00:00:00-04:00`);
    start.setHours(e.startH, e.startM, 0);
    const end = new Date(start.getTime() + e.durMin * 60000);
    return {
      id: e.id,
      title: e.title,
      type: e.type,
      start: start.toISOString(),
      end: end.toISOString(),
    };
  });
}

const TYPE_COLORS: Record<string, string> = {
  constelacao: "#8B5E3C",
  consultoria: "#C8A951",
  planejamento: "#6B8F5E",
  reuniao: "#5E7E8B",
};

const DEMO_EARLY_WINS: Record<string, EarlyWin> = {
  "1": {
    wins: [
      "2a sessão — padrão de exclusão familiar identificado",
      "Preparar campo: mãe e avó materna",
      "Relatou melhora no relacionamento com a mãe",
    ],
  },
  "2": {
    wins: [
      "Revisão do planejamento financeiro trimestral",
      "Atingiu 80% da meta de reserva de emergência",
      "Avaliar realocação pós-Selic",
    ],
  },
  "3": {
    wins: [
      "Definir pauta e dinâmicas do Masterday",
      "12 participantes confirmados (máx. 15)",
      "Revisar material de apoio e checklist",
    ],
  },
  "4": {
    wins: [
      "1a sessão — acolhimento e genograma",
      "Queixa: dificuldade de prosperar financeiramente",
      "Preparar dinâmica de pertencimento",
    ],
  },
  "5": {
    wins: [
      "Alinhamento de metas do mês",
      "Revisar agenda de setembro e Masterdays",
      "Feedback das consultorias em grupo",
    ],
  },
};

export function DaySummary({ userId, isDemo, events: calendarEvents, onEventClick }: DaySummaryProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  useEffect(() => {
    loadEvents();
  }, [selectedDate, isDemo]);

  async function loadEvents() {
    setLoading(true);

    if (isDemo) {
      await new Promise((r) => setTimeout(r, 600));
      setEvents(getDemoEvents(selectedDate));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Liste meus compromissos do dia ${selectedDate}`,
          userId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.action?.type === "list_events") {
          setEvents(data.action.events || []);
        }
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Cuiaba",
    });
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  const today = new Date().toISOString().split("T")[0];
  const isToday = selectedDate === today;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          {isToday ? "Hoje" : formatDate(selectedDate)}
        </h2>
        <input
          type="date"
          className={styles.datePicker}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {isToday && (
        <p className={styles.fullDate}>{formatDate(selectedDate)}</p>
      )}

      <div className={styles.eventsList}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
          </div>
        ) : events.length === 0 ? (
          <div className={styles.emptyState}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="var(--border)" strokeWidth="2" strokeDasharray="4 4" />
              <path d="M24 16v8l6 3" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p>Nenhum compromisso agendado</p>
          </div>
        ) : (
          events.map((event) => {
            const win = isDemo ? DEMO_EARLY_WINS[event.id] : undefined;
            const calEvent = calendarEvents?.find(
              (ce) => ce.title === event.title && ce.startDate === event.start
            );
            const clickable = !!(onEventClick && calEvent);
            return (
              <div
                key={event.id}
                className={`${styles.eventCard} ${clickable ? styles.eventCardClickable : ""} animate-fade-in`}
                style={{ borderLeftColor: TYPE_COLORS[event.type] || "var(--secondary)" }}
                onClick={clickable ? () => onEventClick(calEvent) : undefined}
              >
                <div className={styles.eventTime}>
                  {formatTime(event.start)}
                </div>
                <div className={styles.eventInfo}>
                  <p className={styles.eventTitle}>{event.title}</p>
                  <p className={styles.eventDuration}>
                    {formatTime(event.start)} — {formatTime(event.end)}
                  </p>
                  {win && (
                    <ul className={styles.earlyWinItems}>
                      {win.wins.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{events.length}</span>
          <span className={styles.statLabel}>compromissos</span>
        </div>
        {events.length >= 5 && (
          <span className={styles.busyTag}>Dia cheio</span>
        )}
      </div>

    </div>
  );
}
