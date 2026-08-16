import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  useWindowDimensions, Modal, Pressable, Animated, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet } from "../../lib/api";

const C = {
  primary: "#1a2e18", primaryLight: "#2f4a2b", secondary: "#b8873a",
  gold: "#d9b268", bg: "#f4ede0", surface: "#fdfaf3", white: "#fff",
  text: "#1a2e18", textMuted: "#6b6152", textWarm: "#8a7f6a",
  border: "rgba(26,46,24,0.08)",
};

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  constelacao: { bg: "rgba(184,135,58,0.12)", border: "#b8873a", text: "#8a6420" },
  consultoria: { bg: "rgba(217,178,104,0.15)", border: "#d9b268", text: "#8a6420" },
  planejamento: { bg: "rgba(47,74,43,0.1)", border: "#2f4a2b", text: "#2f4a2b" },
  reuniao: { bg: "rgba(107,97,82,0.1)", border: "#6b6152", text: "#6b6152" },
  bloqueio: { bg: "rgba(0,0,0,0.04)", border: "#8a7f6a", text: "#6b6152" },
  evento: { bg: "rgba(184,135,58,0.08)", border: "#b8873a", text: "#b8873a" },
};

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface CalEvent {
  id: string; title: string; type: string; day: number; startH: number; startM: number; durMin: number;
}

interface AppointmentRow {
  id: string; title: string; appointment_type: string; start_time: string; end_time: string; client_name?: string;
}

function generateDemoEvents(): CalEvent[] {
  const d = new Date().getDate();
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

function appointmentToEvent(row: AppointmentRow): CalEvent {
  const start = new Date(row.start_time);
  const end = new Date(row.end_time);
  const durMin = Math.round((end.getTime() - start.getTime()) / 60000);
  const rawType = (row.appointment_type || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const typeMap: Record<string, string> = { constelacao: "constelacao", consultoria: "consultoria", planejamento: "planejamento", reuniao: "reuniao", bloqueio: "bloqueio", evento: "evento" };
  return {
    id: row.id, title: row.client_name ? `${row.title} — ${row.client_name}` : row.title,
    type: typeMap[rawType] || "evento", day: start.getDate(), startH: start.getHours(), startM: start.getMinutes(), durMin,
  };
}

function pad(n: number) { return n.toString().padStart(2, "0"); }
function getTypeName(type: string) {
  const m: Record<string, string> = { constelacao: "Constelação", consultoria: "Consultoria", planejamento: "Planejamento", reuniao: "Reunião", bloqueio: "Bloqueio", evento: "Evento" };
  return m[type] || type;
}

export default function CalendarioScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const cellSize = Math.floor(screenWidth / 7);
  const circleSize = Math.min(cellSize - 8, 36);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isDemo, setIsDemo] = useState(true);
  const [apiEvents, setApiEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;

  const demoEvents = useMemo(generateDemoEvents, []);
  const events = isDemo ? demoEvents : apiEvents;

  useEffect(() => {
    (async () => {
      const session = await AsyncStorage.getItem("fabi_session");
      if (session) setIsDemo(false);
    })();
  }, []);

  const fetchAppointments = useCallback(async () => {
    if (isDemo) return;
    setLoading(true);
    try {
      const res = await apiGet("/appointments");
      if (res.ok) setApiEvents((await res.json()).map(appointmentToEvent));
    } catch {}
    setLoading(false);
  }, [isDemo]);

  useEffect(() => { if (!isDemo) fetchAppointments(); }, [isDemo, fetchAppointments]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const monthEvents = events.filter((e) => {
    if (isDemo) return true;
    const evDate = new Date(year, month, e.day);
    return evDate.getMonth() === month && evDate.getFullYear() === year;
  });

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));

  const dayEvents = selectedDay ? monthEvents.filter((e) => e.day === selectedDay) : [];

  function prev() { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); }
  function next() { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); }
  function goToday() { setCurrentDate(new Date()); openDay(today.getDate()); }

  function openDay(day: number) {
    setSelectedDay(day);
    setModalVisible(true);
    slideAnim.setValue(400);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }

  function closeModal() {
    Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }).start(() => setModalVisible(false));
  }

  function countEvents(day: number) { return monthEvents.filter((e) => e.day === day).length; }

  return (
    <SafeAreaView style={s.container} edges={["bottom"]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerLabel}>AGENDA</Text>
          <Text style={s.headerTitle}>{MONTHS[month]} <Text style={{ color: C.secondary, fontStyle: "italic" }}>{year}</Text></Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={prev} style={s.navBtn}><Text style={s.navArrow}>‹</Text></TouchableOpacity>
          <TouchableOpacity onPress={goToday} style={s.todayBtn}><Text style={s.todayBtnText}>Hoje</Text></TouchableOpacity>
          <TouchableOpacity onPress={next} style={s.navBtn}><Text style={s.navArrow}>›</Text></TouchableOpacity>
        </View>
      </View>

      {loading && <View style={s.loadingBar}><ActivityIndicator size="small" color={C.secondary} /></View>}

      <View style={s.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <View key={i} style={[s.weekDayCell, { width: cellSize }]}>
            <Text style={s.weekDayText}>{w}</Text>
          </View>
        ))}
      </View>

      <ScrollView style={s.gridScroll}>
        <View style={s.gridContainer}>
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={s.gridRow}>
              {row.map((day, colIdx) => {
                const evCount = day ? countEvents(day) : 0;
                const isToday = isCurrentMonth && day === today.getDate();
                const isSelected = day === selectedDay;
                return (
                  <TouchableOpacity key={colIdx} style={[s.dayCell, { width: cellSize, height: cellSize }]} onPress={() => day && openDay(day)} disabled={!day} activeOpacity={0.5}>
                    {day != null && (
                      <View style={[s.dayCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }, isToday && !isSelected && s.dayCircleToday, isSelected && s.dayCircleSelected]}>
                        <Text style={[s.dayNum, isToday && !isSelected && s.dayNumToday, isSelected && s.dayNumSelected]}>{day}</Text>
                      </View>
                    )}
                    {evCount > 0 && (
                      <View style={s.dotsRow}>
                        {Array.from({ length: Math.min(evCount, 3) }).map((_, i) => (
                          <View key={i} style={[s.eventDot, isSelected && { backgroundColor: C.primary }]} />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        <View style={s.legend}>
          {Object.entries(TYPE_COLORS).map(([key, colors]) => (
            <View key={key} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: colors.border }]} />
              <Text style={s.legendText}>{getTypeName(key)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={closeModal}>
        <Pressable style={s.modalOverlay} onPress={closeModal}>
          <Animated.View style={[s.modalContent, { transform: [{ translateY: slideAnim }] }]} onStartShouldSetResponder={() => true}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{selectedDay} de {MONTHS[month].toLowerCase()} de {year}</Text>
              <Text style={s.modalSubtitle}>{dayEvents.length === 0 ? "Nenhum compromisso" : `${dayEvents.length} compromisso${dayEvents.length > 1 ? "s" : ""}`}</Text>
            </View>

            <ScrollView style={s.modalScroll} contentContainerStyle={{ paddingBottom: 20 }}>
              {dayEvents.length === 0 && (
                <View style={s.emptyState}>
                  <Text style={s.emptyIcon}>📅</Text>
                  <Text style={s.emptyText}>Dia livre</Text>
                  <Text style={s.emptySubtext}>Nenhum compromisso agendado</Text>
                </View>
              )}
              {dayEvents.map((ev) => {
                const colors = TYPE_COLORS[ev.type] || TYPE_COLORS.constelacao;
                const endH = Math.floor((ev.startH * 60 + ev.startM + ev.durMin) / 60);
                const endM = (ev.startH * 60 + ev.startM + ev.durMin) % 60;
                return (
                  <TouchableOpacity key={ev.id} style={[s.evCard, { borderLeftColor: colors.border }]} activeOpacity={0.7}>
                    <View style={s.evCardHeader}>
                      <View style={[s.evTypeBadge, { backgroundColor: colors.bg }]}>
                        <Text style={[s.evTypeText, { color: colors.text }]}>{getTypeName(ev.type)}</Text>
                      </View>
                      <Text style={s.evTimeSmall}>{pad(ev.startH)}:{pad(ev.startM)}</Text>
                    </View>
                    <Text style={s.evTitle} numberOfLines={2}>{ev.title}</Text>
                    <Text style={s.evTime}>{pad(ev.startH)}:{pad(ev.startM)} — {pad(endH)}:{pad(endM)} ({ev.durMin}min)</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={s.closeBtn} onPress={closeModal}>
              <Text style={s.closeBtnText}>Fechar</Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 20, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  headerLabel: { fontSize: 11, letterSpacing: 1, color: C.textMuted, fontWeight: "600" },
  headerTitle: { fontFamily: "serif", fontSize: 28, color: C.primary, lineHeight: 32, marginTop: 4 },
  navBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(26,46,24,0.06)", justifyContent: "center", alignItems: "center" },
  navArrow: { fontSize: 22, color: C.primary, fontWeight: "300" },
  todayBtn: { height: 36, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.primary, justifyContent: "center", alignItems: "center" },
  todayBtnText: { fontSize: 12, fontWeight: "600", color: C.gold },

  loadingBar: { padding: 6, alignItems: "center", backgroundColor: C.surface },

  weekRow: { flexDirection: "row", backgroundColor: C.surface, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  weekDayCell: { alignItems: "center", justifyContent: "center" },
  weekDayText: { fontSize: 10, fontWeight: "600", color: C.textMuted, letterSpacing: 0.8, textTransform: "uppercase" },

  gridScroll: { flex: 1 },
  gridContainer: { backgroundColor: C.surface, paddingTop: 4, paddingBottom: 8 },
  gridRow: { flexDirection: "row" },
  dayCell: { alignItems: "center", justifyContent: "center", paddingVertical: 2 },
  dayCircle: { alignItems: "center", justifyContent: "center" },
  dayCircleToday: { borderWidth: 2, borderColor: C.secondary },
  dayCircleSelected: { backgroundColor: C.primary },
  dayNum: { fontFamily: "serif", fontSize: 15, color: C.text },
  dayNumToday: { fontWeight: "700", color: C.secondary },
  dayNumSelected: { color: "#fff", fontWeight: "600" },

  dotsRow: { flexDirection: "row", gap: 2, marginTop: 2, height: 6, alignItems: "center" },
  eventDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.secondary },

  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.bg },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: C.textMuted },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "70%", paddingBottom: 16 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginTop: 10, marginBottom: 8 },
  modalHeader: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontFamily: "serif", fontSize: 18, fontWeight: "600", color: C.primary },
  modalSubtitle: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  modalScroll: { paddingHorizontal: 16, paddingTop: 12 },

  emptyState: { alignItems: "center", paddingVertical: 32 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontFamily: "serif", fontSize: 16, fontWeight: "600", color: C.primary },
  emptySubtext: { fontSize: 13, color: C.textMuted, marginTop: 4 },

  evCard: { backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4, borderWidth: 1, borderColor: C.border },
  evCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  evTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  evTypeText: { fontSize: 11, fontWeight: "600" },
  evTimeSmall: { fontSize: 13, fontWeight: "600", color: C.primary },
  evTitle: { fontSize: 15, fontWeight: "500", color: C.text, marginBottom: 4 },
  evTime: { fontSize: 12, color: C.textMuted },

  closeBtn: { marginHorizontal: 16, padding: 14, borderRadius: 14, backgroundColor: C.bg, alignItems: "center", borderWidth: 1, borderColor: C.border },
  closeBtnText: { fontSize: 15, fontWeight: "500", color: C.primary },
});
