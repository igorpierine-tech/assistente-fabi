import { useState, useMemo, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authenticatedFetch, hasSession } from "../../services/auth";

const C = {
  primary: "#1A2E18", secondary: "#B8873A", bg: "#FDFAF3", surface: "#FFFFFF",
  text: "#12160F", textLight: "#F4EDE0", textMuted: "#6B6152", border: "rgba(26,46,24,.09)",
};

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  constelacao: { bg: "#FFF3E0", border: "#F57C00", text: "#E65100" },
  consultoria: { bg: "#FFF8E1", border: "#FFC107", text: "#F57F17" },
  planejamento: { bg: "#E8F5E9", border: "#66BB6A", text: "#2E7D32" },
  reuniao: { bg: "#E3F2FD", border: "#42A5F5", text: "#1565C0" },
  bloqueio: { bg: "#F5F5F5", border: "#BDBDBD", text: "#616161" },
  evento: { bg: "#F3E5F5", border: "#AB47BC", text: "#6A1B9A" },
};

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface CalEvent {
  id: string; title: string; type: string; date: Date; startH: number; startM: number; durMin: number;
}

function generateDemoEvents(): CalEvent[] {
  const today = new Date();
  const d = today.getDate();
  return [
    ["1", "Constelação — Maria Valentina", "constelacao", 0, 9, 0, 90], ["2", "Consultoria — Ana Paula", "consultoria", 0, 11, 0, 60],
    ["3", "Planejamento — Masterday", "planejamento", 0, 14, 0, 60], ["4", "Constelação — Juliana Costa", "constelacao", 0, 15, 30, 90],
    ["5", "Reunião — R&R", "reuniao", 0, 17, 30, 30], ["6", "Constelação — Fernanda", "constelacao", 1, 9, 0, 90],
    ["7", "Consultoria — Roberto", "consultoria", 1, 14, 0, 60], ["8", "Constelação — Patrícia", "constelacao", 2, 10, 0, 90],
  ].map(([id, title, type, offset, startH, startM, durMin]) => ({ id: String(id), title: String(title), type: String(type), date: new Date(today.getFullYear(), today.getMonth(), d + Number(offset)), startH: Number(startH), startM: Number(startM), durMin: Number(durMin) }));
}

function pad(n: number) { return n.toString().padStart(2, "0"); }

export default function CalendarioScreen() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const demoEvents = useMemo(generateDemoEvents, []);
  const [events, setEvents] = useState<CalEvent[]>(demoEvents);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!(await hasSession())) { if (active) setEvents(demoEvents); return; }
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      const response = await authenticatedFetch(`/appointments?startDate=${encodeURIComponent(start.toISOString())}&endDate=${encodeURIComponent(end.toISOString())}`);
      if (!response.ok) return;
      const rows: Array<{ id: string; title: string; type: string; start_time: string; end_time: string }> = await response.json();
      if (active) setEvents(rows.map((row) => { const startAt = new Date(row.start_time); const endAt = new Date(row.end_time); return { id: row.id, title: row.title, type: row.type || "evento", date: startAt, startH: startAt.getHours(), startM: startAt.getMinutes(), durMin: Math.max(1, Math.round((endAt.getTime() - startAt.getTime()) / 60000)) }; }));
    }
    load().catch(() => undefined);
    return () => { active = false; };
  }, [currentDate, demoEvents]);

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
    const m: Record<string, string> = { constelacao: "Constelação", consultoria: "Consultoria", planejamento: "Planejamento", reuniao: "Reunião", bloqueio: "Bloqueio", evento: "Evento" };
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
            <View key={ev.id} style={[s.evCard, { borderLeftColor: colors.border }]}>
              <View style={[s.evTypeBadge, { backgroundColor: colors.bg }]}>
                <Text style={[s.evTypeText, { color: colors.text }]}>{getTypeName(ev.type)}</Text>
              </View>
              <Text style={s.evTitle}>{ev.title}</Text>
              <Text style={s.evTime}>{pad(ev.startH)}:{pad(ev.startM)} — {pad(Math.floor((ev.startH * 60 + ev.startM + ev.durMin) / 60))}:{pad((ev.startH * 60 + ev.startM + ev.durMin) % 60)}</Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Legend */}
      <View style={s.legend}>
        {Object.entries(TYPE_COLORS).map(([key, colors]) => (
          <View key={key} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: colors.border }]} />
            <Text style={s.legendText}>{key === "constelacao" ? "Const." : key === "consultoria" ? "Consult." : key === "planejamento" ? "Plan." : key === "reuniao" ? "Reunião" : key === "bloqueio" ? "Bloq." : "Evento"}</Text>
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
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: C.textMuted },
});
