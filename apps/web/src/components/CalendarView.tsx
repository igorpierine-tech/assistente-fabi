"use client";

import { useState, useMemo } from "react";
import styles from "./CalendarView.module.css";
import { isoToLocalInput } from "@/lib/timezone";

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
  onEventClick: (event: CalendarEvent) => void;
  onNewEvent: (date: string) => void;
  /**
   * Called when the user drags an event onto another day. Receives the
   * event and the target day (YYYY-MM-DD, Cuiabá date). Should update the
   * appointment's start/end preserving the time-of-day.
   */
  onEventMove?: (event: CalendarEvent, newDayStr: string) => void | Promise<void>;
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

const HOUR_START = 7;   // 07:00
const HOUR_END = 21;    // 21:00 (exclusive)
const SLOT_HEIGHT_PX = 32; // 30-minute slot height
const HOURS_IN_VIEW = HOUR_END - HOUR_START;

/** Local YYYY-MM-DD (Cuiabá) from a Date; used to align with our stored dates. */
function dateObjToLocalStr(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Return the Sunday-anchored start of week for the given local date. */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** Add N days to a date and return a new Date at 00:00 local time. */
function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Minutes from midnight (Cuiabá TZ) for an ISO string. */
function minutesOfDay(iso: string): number {
  const local = isoToLocalInput(iso); // "YYYY-MM-DDTHH:mm"
  const t = local.split("T")[1] || "00:00";
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function CalendarView({ events, onEventClick, onNewEvent, onEventMove }: CalendarViewProps) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [anchorDate, setAnchorDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [viewMode, setViewMode] = useState<ViewMode>("mes");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, event: CalendarEvent) {
    if (!onEventMove) return;
    setDraggingId(event.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", event.id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverDay(null);
  }

  function handleDayDragOver(e: React.DragEvent<HTMLDivElement>, dayStr: string) {
    if (!draggingId || !onEventMove) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDay !== dayStr) setDragOverDay(dayStr);
  }

  function handleDayDragLeave(dayStr: string) {
    setDragOverDay((prev) => (prev === dayStr ? null : prev));
  }

  async function handleDayDrop(e: React.DragEvent<HTMLDivElement>, dayStr: string) {
    if (!onEventMove || !draggingId) return;
    e.preventDefault();
    const eventId = e.dataTransfer.getData("text/plain") || draggingId;
    const moved = events.find((ev) => ev.id === eventId);
    setDraggingId(null);
    setDragOverDay(null);
    if (!moved) return;
    // Skip no-op drops (dropped on the same day)
    const originalDay = isoToLocalInput(moved.startDate).slice(0, 10);
    if (originalDay === dayStr) return;
    await onEventMove(moved, dayStr);
  }

  const todayStr = dateObjToLocalStr(today);

  function navigate(delta: number) {
    if (viewMode === "mes") {
      let newMonth = currentMonth + delta;
      let newYear = currentYear;
      if (newMonth < 0) { newMonth = 11; newYear--; }
      if (newMonth > 11) { newMonth = 0; newYear++; }
      setCurrentMonth(newMonth);
      setCurrentYear(newYear);
    } else if (viewMode === "semana") {
      setAnchorDate((d) => addDays(d, delta * 7));
    } else {
      setAnchorDate((d) => addDays(d, delta));
    }
  }

  function goToToday() {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    setAnchorDate(t);
  }

  // Days shown in the week view (Sun–Sat containing anchorDate)
  const weekDays = useMemo(() => {
    const start = startOfWeek(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchorDate]);

  // Title for the current view
  const viewTitle = useMemo(() => {
    if (viewMode === "mes") return formatMonthYear(currentYear, currentMonth);
    if (viewMode === "semana") {
      const from = weekDays[0];
      const to = weekDays[6];
      const sameMonth = from.getMonth() === to.getMonth();
      const fromLabel = from.toLocaleDateString("pt-BR", { day: "2-digit", month: sameMonth ? undefined : "short" });
      const toLabel = to.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
      return `${fromLabel} — ${toLabel}`;
    }
    return anchorDate.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, [viewMode, currentYear, currentMonth, weekDays, anchorDate]);

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

  const weeks: typeof calendarDays[] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.navGroup}>
          <button className={styles.navBtn} onClick={() => navigate(-1)} title="Anterior">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className={styles.todayBtn} onClick={goToToday}>Hoje</button>
          <button className={styles.navBtn} onClick={() => navigate(1)} title="Próximo">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <h2 className={styles.monthTitle}>{viewTitle}</h2>

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

      {viewMode === "mes" && (
      /* Calendar Grid — MONTH */
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

              const isDropTarget = dragOverDay === dayStr;
              const openDayView = () => {
                setAnchorDate(new Date(cell.year, cell.month, cell.day));
                setViewMode("dia");
              };
              return (
                <div
                  key={dayStr}
                  className={`${styles.dayCell} ${!cell.isCurrentMonth ? styles.dayCellOther : ""} ${isToday ? styles.dayCellToday : ""} ${isDropTarget ? styles.dayCellDropTarget : ""}`}
                  onClick={openDayView}
                  onDragOver={(e) => handleDayDragOver(e, dayStr)}
                  onDragLeave={() => handleDayDragLeave(dayStr)}
                  onDrop={(e) => handleDayDrop(e, dayStr)}
                  title="Clique para ver o dia"
                >
                  <span
                    className={`${styles.dayNumber} ${isToday ? styles.dayNumberToday : ""}`}
                  >
                    {cell.day}
                  </span>
                  <div className={styles.dayEvents}>
                    {dayEvents.slice(0, maxShow).map((ev) => {
                      const colors = TYPE_COLORS[ev.type] || TYPE_COLORS.outro;
                      const isDragging = draggingId === ev.id;
                      return (
                        <div
                          key={ev.id}
                          className={`${styles.eventBar} ${isDragging ? styles.eventBarDragging : ""}`}
                          style={{ background: colors.bg, borderLeft: `3px solid ${colors.border}`, color: colors.text }}
                          onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                          title={onEventMove ? `${ev.title}\nArraste para mover de dia` : ev.title}
                          draggable={!!onEventMove}
                          onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, ev); }}
                          onDragEnd={handleDragEnd}
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
      )}

      {viewMode === "semana" && (
        <TimeGridView
          days={weekDays}
          events={events}
          todayStr={todayStr}
          onEventClick={onEventClick}
          onNewEvent={onNewEvent}
          onEventMove={onEventMove}
          draggingId={draggingId}
          dragOverDay={dragOverDay}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDayDragOver={handleDayDragOver}
          onDayDragLeave={handleDayDragLeave}
          onDayDrop={handleDayDrop}
        />
      )}

      {viewMode === "dia" && (
        <TimeGridView
          days={[anchorDate]}
          events={events}
          todayStr={todayStr}
          onEventClick={onEventClick}
          onNewEvent={onNewEvent}
          onEventMove={onEventMove}
          draggingId={draggingId}
          dragOverDay={dragOverDay}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDayDragOver={handleDayDragOver}
          onDayDragLeave={handleDayDragLeave}
          onDayDrop={handleDayDrop}
        />
      )}

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

/**
 * Week/Day view — hour-based grid with events positioned by time-of-day.
 * A single day column is shown when `days.length === 1`.
 */
interface TimeGridViewProps {
  days: Date[];
  events: CalendarEvent[];
  todayStr: string;
  onEventClick: (event: CalendarEvent) => void;
  onNewEvent: (date: string) => void;
  onEventMove?: (event: CalendarEvent, newDayStr: string) => void | Promise<void>;
  draggingId: string | null;
  dragOverDay: string | null;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, event: CalendarEvent) => void;
  onDragEnd: () => void;
  onDayDragOver: (e: React.DragEvent<HTMLDivElement>, dayStr: string) => void;
  onDayDragLeave: (dayStr: string) => void;
  onDayDrop: (e: React.DragEvent<HTMLDivElement>, dayStr: string) => void;
}

function TimeGridView({
  days,
  events,
  todayStr,
  onEventClick,
  onNewEvent,
  onEventMove,
  draggingId,
  dragOverDay,
  onDragStart,
  onDragEnd,
  onDayDragOver,
  onDayDragLeave,
  onDayDrop,
}: TimeGridViewProps) {
  const hours = Array.from({ length: HOURS_IN_VIEW }, (_, i) => HOUR_START + i);
  const totalHeight = HOURS_IN_VIEW * SLOT_HEIGHT_PX * 2;

  function eventsForDay(dayStr: string): CalendarEvent[] {
    return events.filter((e) => {
      const start = isoToLocalInput(e.startDate).slice(0, 10);
      return start === dayStr;
    });
  }

  const gridColumns = `56px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className={styles.timeGrid}>
      <div className={styles.timeGridHeader} style={{ gridTemplateColumns: gridColumns }}>
        <div className={styles.timeGutterHeader} />
        {days.map((d) => {
          const dayStr = dateObjToLocalStr(d);
          const isToday = dayStr === todayStr;
          return (
            <div
              key={dayStr}
              className={`${styles.timeGridDayHeader} ${isToday ? styles.timeGridDayHeaderToday : ""}`}
            >
              <div className={styles.timeGridWeekday}>
                {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").toUpperCase()}
              </div>
              <div className={`${styles.timeGridDayNumber} ${isToday ? styles.timeGridDayNumberToday : ""}`}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={styles.timeGridBody}
        style={{ gridTemplateColumns: gridColumns }}
      >
        <div className={styles.timeGutter} style={{ height: totalHeight }}>
          {hours.map((h) => (
            <div key={h} className={styles.timeGutterHour} style={{ height: SLOT_HEIGHT_PX * 2 }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {days.map((d) => {
          const dayStr = dateObjToLocalStr(d);
          const dayEvents = eventsForDay(dayStr);
          const isDropTarget = dragOverDay === dayStr;

          return (
            <div
              key={dayStr}
              className={`${styles.timeGridDayColumn} ${isDropTarget ? styles.dayCellDropTarget : ""}`}
              style={{ height: totalHeight }}
              onClick={() => onNewEvent(dayStr)}
              onDragOver={(e) => onDayDragOver(e, dayStr)}
              onDragLeave={() => onDayDragLeave(dayStr)}
              onDrop={(e) => onDayDrop(e, dayStr)}
            >
              {hours.map((_, i) => (
                <div
                  key={i}
                  className={styles.timeGridHourLine}
                  style={{ top: i * SLOT_HEIGHT_PX * 2 }}
                />
              ))}

              {dayEvents.map((ev) => {
                const startMin = minutesOfDay(ev.startDate);
                const endMin = minutesOfDay(ev.endDate);
                const viewStartMin = HOUR_START * 60;
                const top = ((startMin - viewStartMin) / 30) * SLOT_HEIGHT_PX;
                const height = Math.max(
                  20,
                  ((endMin - startMin) / 30) * SLOT_HEIGHT_PX - 2
                );
                if (endMin <= viewStartMin) return null;
                const colors = TYPE_COLORS[ev.type] || TYPE_COLORS.outro;
                const isDragging = draggingId === ev.id;
                return (
                  <div
                    key={ev.id}
                    className={`${styles.timeGridEvent} ${isDragging ? styles.eventBarDragging : ""}`}
                    style={{
                      top: Math.max(0, top),
                      height,
                      background: colors.bg,
                      borderLeft: `3px solid ${colors.border}`,
                      color: colors.text,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    title={onEventMove ? `${ev.title}\nArraste para mover de dia` : ev.title}
                    draggable={!!onEventMove}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      onDragStart(e, ev);
                    }}
                    onDragEnd={onDragEnd}
                  >
                    <span
                      className={styles.eventDot}
                      style={{ background: STATUS_DOT[ev.status] || STATUS_DOT.previsto }}
                    />
                    <div className={styles.timeGridEventBody}>
                      <div className={styles.timeGridEventTime}>
                        {String(Math.floor(startMin / 60)).padStart(2, "0")}
                        :
                        {String(startMin % 60).padStart(2, "0")}
                        {" — "}
                        {String(Math.floor(endMin / 60)).padStart(2, "0")}
                        :
                        {String(endMin % 60).padStart(2, "0")}
                      </div>
                      <div className={styles.timeGridEventTitle}>{ev.title}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
