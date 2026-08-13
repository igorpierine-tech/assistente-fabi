import { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const C = {
  primary: "#5E4B37", secondary: "#C4A265", bg: "#FBF8F3", surface: "#FFFFFF",
  text: "#2C2418", textLight: "#F5F0E8", textMuted: "#8B8078", border: "#E8E0D4",
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
  id: string; title: string; type: string; day: number; startH: number; startM: number; durMin: number;
}

function generateDemoEvents(): CalEvent[] {
  const today = new Date();
  const d = today.getDate();
  return [
    { id: "1", title: "Constelação — Maria Valentina", type: "constelacao", day: d, startH: 9, startM: 0, durMin: 90 },
    { id: "2", title: "Consultoria — Ana Paula", type: "consultoria", day: d, startH: 11, startM: 0, durMin: 60 },
    { id: "3", title: "Planejamento — Masterday", type: "planejamento", day: d, startH: 14, startM: 0, durMin: 60 },
    { id: "4", title: "Constelação — Juliana Costa", type: "constelacao", day: d, startH: 15, startM: 30, durMin: 90 },
    { id: "5", title: "Reunião — R&R", type: "reuniao", day: d, startH: 17, startM: 30, durMin: 30 },
    { id: "6", title: "Constelação — Fernanda", type: "constelacao", day: d + 1, startH: 9, startM: 0, durMin: 90 },
    { id: "7", title: "Consultoria — Roberto", type: "consultoria", day: d + 1, startH: 14, startM: 0, durMin: 60 },
    { id: "8", title: "Constelação — Patrícia", type: "constelacao", day: d + 2, startH: 10, startM: 0, durMin: 90 },
    { id: "9", title: "Planejamento Financeiro", type: "planejamento", day: d + 3, startH: 8, startM: 0, durMin: 120 },
    { id: "10", title: "Constelação — Marcos", type: "constelacao", day: d + 3, startH: 14, startM: 0, durMin: 90 },
    { id: "11", title: "Masterday", type: "evento", day: d + 5, startH: 9, startM: 0, durMin: 480 },
    { id: "12", title: "Constelação — Luciana", type: "constelacao", day: d - 1, startH: 9, startM: 0, durMin: 90 },
    { id: "13", title: "Consultoria — Carla", type: "consultoria", day: d - 1, startH: 14, startM: 0, durMin: 60 },
    { id: "14", title: "Constelação — Pedro", type: "constelacao", day: d - 3, startH: 15, startM: 0, durMin: 90 },
    { id: "15", title: "Constelação — Amanda", type: "constelacao", day: d + 7, startH: 9, startM: 0, durMin: 90 },
    { id: "16", title: "Constelação — Beatriz", type: "constelacao", day: d + 10, startH: 10, startM: 0, durMin: 90 },
  ];
}

function pad(n: number) { return n.toString().padStart(2, "0"); }

export default function CalendarioScreen() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const events = useMemo(generateDemoEvents, []);

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

  const dayEvents = selectedDay ? events.filter((e) => e.day === selectedDay) : [];

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
          const hasEvents = day ? events.some((e) => e.day === day) : false;
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
