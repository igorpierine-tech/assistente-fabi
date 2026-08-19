"use client";

import { useState, useEffect } from "react";
import styles from "./DaySummary.module.css";
import type { CalendarEvent } from "./CalendarView";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface DaySummaryProps {
  userId: string;
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

const TYPE_COLORS: Record<string, string> = {
  constelacao: "#8B5E3C",
  consultoria: "#C8A951",
  planejamento: "#6B8F5E",
  reuniao: "#5E7E8B",
};

export function DaySummary({ userId, events: calendarEvents, onEventClick }: DaySummaryProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  useEffect(() => {
    loadEvents();
  }, [selectedDate]);

  async function loadEvents() {
    setLoading(true);

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
