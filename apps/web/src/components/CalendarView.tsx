"use client";

import { useState, useMemo } from "react";
import styles from "./CalendarView.module.css";

export interface CalendarEvent {
  id: string;
  title: string;
  type: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  startDate: string;
  endDate: string;
  notes?: string;
  status: "previsto" | "confirmado" | "em_andamento" | "concluido" | "cancelado";
}

interface CalendarViewProps {
  events: CalendarEvent[];
  isDemo?: boolean;
  onEventClick: (event: CalendarEvent) => void;
  onNewEvent: (date: string) => void;
}

type ViewMode = "mes" | "semana" | "dia";

const WEEKDAYS = ["DOM.", "SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB."];

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  constelacao: { bg: "#FFF3E0", border: "#F57C00", text: "#E65100" },
  consultoria_financeira: { bg: "#FFF8E1", border: "#FFC107", text: "#F57F17" },
  planejamento: { bg: "#E8F5E9", border: "#66BB6A", text: "#2E7D32" },
  reuniao: { bg: "#E3F2FD", border: "#42A5F5", text: "#1565C0" },
  bloqueio_pessoal: { bg: "#F5F5F5", border: "#BDBDBD", text: "#616161" },
  evento_curso: { bg: "#F3E5F5", border: "#AB47BC", text: "#6A1B9A" },
  outro: { bg: "#ECEFF1", border: "#78909C", text: "#37474F" },
};

const STATUS_DOT: Record<string, string> = {
  previsto: "#FFA726",
  confirmado: "#66BB6A",
  em_andamento: "#42A5F5",
  concluido: "#78909C",
  cancelado: "#EF5350",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatMonthYear(year: number, month: number) {
  const date = new Date(year, month, 1);
  const monthName = date.toLocaleDateString("pt-BR", { month: "long" });
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} — ${year}`;
}

function isSameDay(d1: string, d2: string) {
  return d1.slice(0, 10) === d2.slice(0, 10);
}

function dateToStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function eventSpansDays(event: CalendarEvent): boolean {
  return event.startDate.slice(0, 10) !== event.endDate.slice(0, 10);
}

export function CalendarView({ events, isDemo, onEventClick, onNewEvent }: CalendarViewProps) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [viewMode, setViewMode] = useState<ViewMode>("mes");

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function navigateMonth(delta: number) {
    let newMonth = currentMonth + delta;
    let newYear = currentYear;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0; newYear++; }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  }

  function goToToday() {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  }

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

    const days: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, month: prevMonth, year: prevYear, isCurrentMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, month: currentMonth, year: currentYear, isCurrentMonth: true });
    }

    const remaining = 42 - days.length;
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, month: nextMonth, year: nextYear, isCurrentMonth: false });
    }

    return days;
  }, [currentYear, currentMonth]);

  function getEventsForDay(dayStr: string) {
    return events.filter((e) => {
      const start = e.startDate.slice(0, 10);
      const end = e.endDate.slice(0, 10);
      return dayStr >= start && dayStr <= end;
    });
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Cuiaba",
    });
  }

  const weeks: typeof calendarDays[] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.navGroup}>
          <button className={styles.navBtn} onClick={() => navigateMonth(-1)} title="Mês anterior">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className={styles.todayBtn} onClick={goToToday}>Hoje</button>
          <button className={styles.navBtn} onClick={() => navigateMonth(1)} title="Próximo mês">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <h2 className={styles.monthTitle}>{formatMonthYear(currentYear, currentMonth)}</h2>

        <div className={styles.viewGroup}>
          {(["mes", "semana", "dia"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              className={`${styles.viewBtn} ${viewMode === mode ? styles.viewActive : ""}`}
              onClick={() => setViewMode(mode)}
            >
              {mode === "mes" ? "Mês" : mode === "semana" ? "Semana" : "Dia"}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className={styles.grid}>
        {/* Header */}
        <div className={styles.headerRow}>
          {WEEKDAYS.map((wd) => (
            <div key={wd} className={styles.headerCell}>{wd}</div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className={styles.weekRow}>
            {week.map((cell) => {
              const dayStr = dateToStr(cell.year, cell.month, cell.day);
              const dayEvents = getEventsForDay(dayStr);
              const isToday = dayStr === todayStr;
              const maxShow = 3;
              const overflow = dayEvents.length - maxShow;

              return (
                <div
                  key={dayStr}
                  className={`${styles.dayCell} ${!cell.isCurrentMonth ? styles.dayCellOther : ""} ${isToday ? styles.dayCellToday : ""}`}
                  onClick={() => onNewEvent(dayStr)}
                >
                  <span className={`${styles.dayNumber} ${isToday ? styles.dayNumberToday : ""}`}>
                    {cell.day}
                  </span>
                  <div className={styles.dayEvents}>
                    {dayEvents.slice(0, maxShow).map((ev) => {
                      const colors = TYPE_COLORS[ev.type] || TYPE_COLORS.outro;
                      return (
                        <div
                          key={ev.id}
                          className={styles.eventBar}
                          style={{ background: colors.bg, borderLeft: `3px solid ${colors.border}`, color: colors.text }}
                          onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                          title={ev.title}
                        >
                          <span className={styles.eventDot} style={{ background: STATUS_DOT[ev.status] || STATUS_DOT.previsto }} />
                          <span className={styles.eventBarTitle}>{ev.title}</span>
                        </div>
                      );
                    })}
                    {overflow > 0 && (
                      <div className={styles.eventOverflow}>+{overflow} mais</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {Object.entries(TYPE_COLORS).map(([type, colors]) => (
          <div key={type} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: colors.border }} />
            <span className={styles.legendLabel}>
              {type === "constelacao" ? "Constelação" :
               type === "consultoria_financeira" ? "Consultoria" :
               type === "planejamento" ? "Planejamento" :
               type === "reuniao" ? "Reunião" :
               type === "bloqueio_pessoal" ? "Bloqueio" :
               type === "evento_curso" ? "Evento/Curso" : "Outro"}
            </span>
          </div>
        ))}
        <div className={styles.legendDivider} />
        {Object.entries(STATUS_DOT).map(([status, color]) => (
          <div key={status} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: color }} />
            <span className={styles.legendLabel}>
              {status === "previsto" ? "Previsto" :
               status === "confirmado" ? "Confirmado" :
               status === "em_andamento" ? "Em andamento" :
               status === "concluido" ? "Concluído" : "Cancelado"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
