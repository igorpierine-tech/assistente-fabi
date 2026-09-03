import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authenticatedFetch, hasSession } from "../../services/auth";

const C = {
  primary: "#1A2E18", secondary: "#B8873A", bg: "#FDFAF3", surface: "#FFFFFF",
  text: "#12160F", textLight: "#F4EDE0", textMuted: "#6B6152", border: "rgba(26,46,24,.09)",
};

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  constelacao: { bg: "#FFF3E0", border: "#F57C00", text: "#E65100" },
  consultoria_financeira: { bg: "#FFF8E1", border: "#FFC107", text: "#F57F17" },
  planejamento: { bg: "#E8F5E9", border: "#66BB6A", text: "#2E7D32" },
  reuniao: { bg: "#E3F2FD", border: "#42A5F5", text: "#1565C0" },
  bloqueio_pessoal: { bg: "#F5F5F5", border: "#BDBDBD", text: "#616161" },
  evento_curso: { bg: "#F3E5F5", border: "#AB47BC", text: "#6A1B9A" },
  outro: { bg: "#ECEFF1", border: "#78909C", text: "#37474F" },
};

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface CalEvent {
  id: string; title: string; type: string; date: Date; startH: number; startM: number; durMin: number;
  startIso: string; endIso: string;
}

function pad(n: number) { return n.toString().padStart(2, "0"); }

/** Return a Cuiabá-anchored ISO for date+time. Handles the -4 UTC offset. */
function cuiabaDayAndTimeToIso(day: Date, hour: number, minute: number): string {
  // Cuiabá is UTC-4 year-round. We build UTC by adding 4h to the local time.
  const utc = Date.UTC(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hour + 4,
    minute
  );
  return new Date(utc).toISOString();
}

/** Extract date parts (year/month/day/hour/minute) from an ISO in Cuiabá TZ. */
function cuiabaParts(iso: string): {
  year: number; month: number; day: number; hour: number; minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  return {
    year: Number(parts.year),
    month: Number(parts.month) - 1,
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? 0 : parts.hour),
    minute: Number(parts.minute),
  };
}

export default function CalendarioScreen() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [moving, setMoving] = useState<CalEvent | null>(null);
  const [movingBusy, setMovingBusy] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!(await hasSession())) { if (active) setEvents([]); return; }
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      const response = await authenticatedFetch(
        `/appointments?startDate=${encodeURIComponent(start.toISOString())}&endDate=${encodeURIComponent(end.toISOString())}`
      );
      if (!response.ok) return;
      const rows: Array<{
        id: string; title: string; type: string; start_time: string; end_time: string;
      }> = await response.json();
      if (active)
        setEvents(
          rows.map((row) => {
            const startAt = cuiabaParts(row.start_time);
            const endAt = new Date(row.end_time).getTime();
            const startMs = new Date(row.start_time).getTime();
            return {
              id: row.id,
              title: row.title,
              type: row.type || "outro",
              date: new Date(startAt.year, startAt.month, startAt.day),
              startH: startAt.hour,
              startM: startAt.minute,
              durMin: Math.max(1, Math.round((endAt - startMs) / 60000)),
              startIso: row.start_time,
              endIso: row.end_time,
            };
          })
        );
    }
    load().catch(() => undefined);
    return () => { active = false; };
  }, [currentDate, refreshTrigger]);

  const rescheduleTo = useCallback(
    async (targetDate: Date) => {
      if (!moving) return;
      setMovingBusy(true);
      try {
        // Preserve original time-of-day, change only the date part.
        const newStartIso = cuiabaDayAndTimeToIso(
          targetDate,
          moving.startH,
          moving.startM
        );
        const durationMs = new Date(moving.endIso).getTime() - new Date(moving.startIso).getTime();
        const newEndIso = new Date(new Date(newStartIso).getTime() + durationMs).toISOString();

        const res = await authenticatedFetch(`/appointments/${moving.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startTime: newStartIso, endTime: newEndIso }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          Alert.alert("Erro", err.error || "Não foi possível mover o agendamento.");
          return;
        }
        setMoving(null);
        setRefreshTrigger((t) => t + 1);
      } finally {
        setMovingBusy(false);
      }
    },
    [moving]
  );

  function openMoveModal(event: CalEvent) {
    setMoving(event);
  }

  // Build a list of upcoming dates for the picker (30 days)
  const upcomingDays = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);

  const monthEvents = events.filter((e) => e.date.getFullYear() === year && e.date.getMonth() === month);
  const dayEvents = selectedDay ? monthEvents.filter((e) => e.date.getDate() === selectedDay) : [];

  function prev() { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); }
  function next() { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); }
  function goToday() { setCurrentDate(new Date()); setSelectedDay(today.getDate()); }

  function getTypeName(type: string) {
    const m: Record<string, string> = {
      constelacao: "Constelação",
      consultoria_financeira: "Consultoria",
      planejamento: "Planejamento",
      reuniao: "Reunião",
      bloqueio_pessoal: "Bloqueio",
      evento_curso: "Evento",
      outro: "Outro",
    };
    return m[type] || type;
  }

  return (
    <SafeAreaView style={s.container} edges={["bottom"]}>
      {/* Month nav */}
      <View style={s.monthNav}>
        <TouchableOpacity onPress={prev}><Text style={s.navArrow}>‹</Text></TouchableOpacity>
        <TouchableOpacity onPress={goToday}>
          <Text style={s.monthTitle}>{MONTHS[month]} {year}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={next}><Text style={s.navArrow}>›</Text></TouchableOpacity>
      </View>

      {/* Weekday headers */}
      <View style={s.weekRow}>
        {WEEKDAYS.map((w, i) => <Text key={i} style={s.weekDay}>{w}</Text>)}
      </View>

      {/* Calendar grid */}
      <View style={s.grid}>
        {days.map((day, i) => {
          const hasEvents = day ? monthEvents.some((e) => e.date.getDate() === day) : false;
          const isToday = isCurrentMonth && day === today.getDate();
          const isSelected = day === selectedDay;
          return (
            <TouchableOpacity
              key={i}
              style={[s.dayCell, isToday && s.dayCellToday, isSelected && s.dayCellSelected]}
              onPress={() => day && setSelectedDay(day)}
              disabled={!day}
            >
              {day && (
                <>
                  <Text style={[s.dayNum, isToday && s.dayNumToday, isSelected && s.dayNumSelected]}>{day}</Text>
                  {hasEvents && <View style={[s.eventDot, isSelected && { backgroundColor: "#fff" }]} />}
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected day events */}
      <ScrollView style={s.eventsList} contentContainerStyle={{ paddingBottom: 16 }}>
        {selectedDay && (
          <Text style={s.selectedTitle}>
            {selectedDay} de {MONTHS[month].toLowerCase()}
          </Text>
        )}
        {dayEvents.length === 0 && selectedDay && (
          <Text style={s.noEvents}>Nenhum compromisso neste dia</Text>
        )}
        {dayEvents.map((ev) => {
          const colors = TYPE_COLORS[ev.type] || TYPE_COLORS.constelacao;
          return (
            <TouchableOpacity
              key={ev.id}
              style={[s.evCard, { borderLeftColor: colors.border }]}
              onLongPress={() => openMoveModal(ev)}
              activeOpacity={0.85}
              delayLongPress={350}
            >
              <View style={[s.evTypeBadge, { backgroundColor: colors.bg }]}>
                <Text style={[s.evTypeText, { color: colors.text }]}>
                  {getTypeName(ev.type)}
                </Text>
              </View>
              <Text style={s.evTitle}>{ev.title}</Text>
              <Text style={s.evTime}>
                {pad(ev.startH)}:{pad(ev.startM)} —{" "}
                {pad(Math.floor((ev.startH * 60 + ev.startM + ev.durMin) / 60))}:
                {pad((ev.startH * 60 + ev.startM + ev.durMin) % 60)}
              </Text>
              <Text style={s.evHint}>Segure para mover ↔</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Move-to-day modal */}
      <Modal
        visible={!!moving}
        transparent
        animationType="slide"
        onRequestClose={() => setMoving(null)}
      >
        <View style={s.moveOverlay}>
          <View style={s.moveSheet}>
            <Text style={s.moveTitle}>Mover para outro dia</Text>
            {moving && (
              <Text style={s.moveSub}>
                {moving.title}
                {"\n"}
                <Text style={{ color: C.textMuted, fontSize: 13 }}>
                  Horário mantido: {pad(moving.startH)}:{pad(moving.startM)}
                </Text>
              </Text>
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.dayChips}
            >
              {upcomingDays.map((d) => {
                const label = d.toLocaleDateString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  timeZone: "America/Cuiaba",
                });
                return (
                  <TouchableOpacity
                    key={d.getTime()}
                    style={s.dayChip}
                    onPress={() => rescheduleTo(d)}
                    disabled={movingBusy}
                  >
                    <Text style={s.dayChipText}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {movingBusy && (
              <View style={{ paddingVertical: 10, alignItems: "center" }}>
                <ActivityIndicator color={C.secondary} />
              </View>
            )}
            <TouchableOpacity
              style={s.moveCancel}
              onPress={() => setMoving(null)}
              disabled={movingBusy}
            >
              <Text style={s.moveCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Legend */}
      <View style={s.legend}>
        {Object.entries(TYPE_COLORS).map(([key, colors]) => (
          <View key={key} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: colors.border }]} />
            <Text style={s.legendText}>
              {key === "constelacao"
                ? "Const."
                : key === "consultoria_financeira"
                ? "Consult."
                : key === "planejamento"
                ? "Plan."
                : key === "reuniao"
                ? "Reunião"
                : key === "bloqueio_pessoal"
                ? "Bloq."
                : key === "evento_curso"
                ? "Evento"
                : "Outro"}
            </Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  monthNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  navArrow: { fontSize: 28, color: C.primary, paddingHorizontal: 12 },
  monthTitle: { fontFamily: "serif", fontSize: 18, fontWeight: "600", color: C.primary },
  weekRow: { flexDirection: "row", backgroundColor: C.surface, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  weekDay: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600", color: C.textMuted },
  grid: { flexDirection: "row", flexWrap: "wrap", backgroundColor: C.surface, paddingBottom: 8 },
  dayCell: { width: "14.28%", aspectRatio: 1, justifyContent: "center", alignItems: "center", gap: 2 },
  dayCellToday: { },
  dayCellSelected: { backgroundColor: C.primary, borderRadius: 20 },
  dayNum: { fontSize: 14, color: C.text },
  dayNumToday: { fontWeight: "700", color: C.secondary },
  dayNumSelected: { color: "#fff", fontWeight: "600" },
  eventDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.secondary },
  eventsList: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  selectedTitle: { fontSize: 15, fontWeight: "600", color: C.primary, marginBottom: 10, textTransform: "capitalize" },
  noEvents: { fontSize: 14, color: C.textMuted, textAlign: "center", paddingVertical: 24 },
  evCard: { backgroundColor: C.surface, borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 3, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  evTypeBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginBottom: 4 },
  evTypeText: { fontSize: 11, fontWeight: "600" },
  evTitle: { fontSize: 14, fontWeight: "500", color: C.text, marginBottom: 2 },
  evTime: { fontSize: 12, color: C.textMuted },
  evHint: { fontSize: 10, color: C.secondary, marginTop: 6, opacity: 0.7 },
  moveOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  moveSheet: { backgroundColor: C.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 32 },
  moveTitle: { color: C.primary, fontFamily: "serif", fontSize: 20 },
  moveSub: { color: C.text, fontSize: 14, marginTop: 8, lineHeight: 20 },
  dayChips: { paddingVertical: 16, gap: 8 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, marginRight: 6 },
  dayChipText: { color: C.primary, fontSize: 13, fontWeight: "600" },
  moveCancel: { alignSelf: "center", paddingHorizontal: 20, paddingVertical: 12, marginTop: 6 },
  moveCancelText: { color: C.textMuted, fontWeight: "600" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: C.textMuted },
});
