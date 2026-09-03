import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { authenticatedFetch, clearSession, hasSession } from "../../services/auth";
import { RR } from "../../config/theme";

type Appointment = { id: string; title: string; client_name?: string | null; start_time: string; end_time: string };

function greeting() {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Cuiaba",
      hour: "2-digit",
      hour12: false,
    }).format(new Date())
  );
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
function time(iso?: string) {
  return iso
    ? new Date(iso).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Cuiaba",
      })
    : "—";
}
function isToday(iso: string): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" });
  return fmt.format(new Date(iso)) === fmt.format(new Date());
}

export default function InicioScreen() {
  const [events, setEvents] = useState<Appointment[]>([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!(await hasSession())) { setLoading(false); return; }
      const [appointments, requests] = await Promise.all([authenticatedFetch("/appointments"), authenticatedFetch("/booking/requests/pending-count")]);
      if (active && appointments.ok) setEvents(await appointments.json());
      if (active && requests.ok) setPending((await requests.json()).count || 0);
      if (active) setLoading(false);
    }
    load().catch(() => setLoading(false));
    return () => { active = false; };
  }, []);

  const today = useMemo(
    () =>
      events
        .filter((e) => isToday(e.start_time))
        .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time)),
    [events]
  );
  const next = today.find((e) => new Date(e.end_time) > new Date()) || today[0];
  const date = new Date().toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "America/Cuiaba",
  });

  return <SafeAreaView style={s.root} edges={["bottom"]}><ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
    <View style={s.top}><View style={s.brandMark}><Text style={s.brandLetter}>R</Text></View><View style={{ flex: 1 }}><Text style={s.eyebrow}>{greeting()},</Text><Text style={s.name}>Fabiana</Text></View><TouchableOpacity style={s.bell} onPress={() => router.push("/(tabs)/agendamentos")}><Text style={s.bellIcon}>♢</Text>{pending > 0 && <View style={s.count}><Text style={s.countText}>{pending}</Text></View>}</TouchableOpacity></View>
    <View style={s.hero}><View style={s.orbit} /><Text style={s.heroEyebrow}>HOJE · {date.toUpperCase()}</Text>{loading ? <ActivityIndicator color={RR.goldLight} style={{ marginVertical: 28 }} /> : <><Text style={s.heroTitle}>{today.length} <Text style={s.heroGold}>{today.length === 1 ? "encontro" : "encontros"}</Text>{"\n"}agendados</Text><View style={s.nextRow}><View style={s.nextBox}><Text style={s.nextLabel}>PRÓXIMO</Text><Text style={s.nextValue}>{next ? `${time(next.start_time)} · ${next.client_name || next.title}` : "Agenda livre"}</Text></View><TouchableOpacity style={s.arrow} onPress={() => router.push("/(tabs)/calendario")}><Text style={s.arrowText}>→</Text></TouchableOpacity></View></>}</View>
    <TouchableOpacity style={s.aiCard} onPress={() => router.push("/(tabs)/assistente")}><View style={s.aiIcon}><Text style={s.spark}>✦</Text></View><View style={{ flex: 1 }}><Text style={s.aiLabel}>ASSISTENTE</Text><Text style={s.aiText}>Pergunte alguma coisa…</Text></View><Text style={s.sun}>✧</Text></TouchableOpacity>
    <Text style={s.section}>ATALHOS</Text><View style={s.shortcuts}><TouchableOpacity style={s.shortcut} onPress={() => router.push("/(tabs)/clientes")}><View style={s.shortcutIcon}><Text style={s.shortcutGlyph}>＋</Text></View><Text style={s.shortcutTitle}>Novo cliente</Text><Text style={s.shortcutSub}>Cadastro e contatos</Text></TouchableOpacity><TouchableOpacity style={s.shortcut} onPress={() => router.push("/(tabs)/calendario")}><View style={[s.shortcutIcon, { backgroundColor: "rgba(47,74,43,.1)" }]}><Text style={[s.shortcutGlyph, { color: RR.leaf }]}>□</Text></View><Text style={s.shortcutTitle}>Ver agenda</Text><Text style={s.shortcutSub}>Compromissos reais</Text></TouchableOpacity></View>
    {pending > 0 && <TouchableOpacity style={s.pending} onPress={() => router.push("/(tabs)/agendamentos")}><View style={s.pendingBar} /><View style={{ flex: 1 }}><Text style={s.pendingTitle}>{pending} {pending === 1 ? "pedido aguarda" : "pedidos aguardam"} você</Text><Text style={s.pendingSub}>Toque para revisar e responder</Text></View><Text style={s.pendingArrow}>Ver →</Text></TouchableOpacity>}
    <TouchableOpacity style={{ alignSelf: "center", paddingVertical: 14, paddingHorizontal: 18, marginTop: 8 }} onPress={() => Alert.alert("Sair", "Deseja encerrar sua sessão?", [{ text: "Cancelar", style: "cancel" }, { text: "Sair", style: "destructive", onPress: async () => { await clearSession(); router.replace("/"); } }])}><Text style={{ color: RR.muted, fontSize: 12, fontWeight: "600" }}>Sair da conta</Text></TouchableOpacity>
  </ScrollView></SafeAreaView>;
}

const s = StyleSheet.create({ root: { flex: 1, backgroundColor: RR.cream }, content: { padding: 16, paddingTop: 18, paddingBottom: 32 }, top: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 4 }, brandMark: { width: 34, height: 34, borderRadius: 17, backgroundColor: RR.forest, justifyContent: "center", alignItems: "center" }, brandLetter: { color: RR.goldLight, fontFamily: "serif", fontSize: 21, fontStyle: "italic" }, eyebrow: { fontSize: 9, letterSpacing: 1.2, color: RR.muted }, name: { fontSize: 15, fontWeight: "700", color: RR.forest }, bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(26,46,24,.08)", alignItems: "center", justifyContent: "center" }, bellIcon: { color: RR.forest, fontSize: 24 }, count: { position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: RR.gold, alignItems: "center", justifyContent: "center" }, countText: { color: "#fff", fontSize: 10, fontWeight: "700" }, hero: { marginTop: 18, padding: 21, borderRadius: 22, backgroundColor: RR.forest, overflow: "hidden" }, orbit: { position: "absolute", width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: "rgba(217,178,104,.14)", right: -35, top: -30 }, heroEyebrow: { color: RR.goldLight, fontSize: 10, fontWeight: "700", letterSpacing: 1.4 }, heroTitle: { color: RR.cream, fontFamily: "serif", fontSize: 34, lineHeight: 37, marginTop: 8 }, heroGold: { color: RR.goldLight, fontStyle: "italic" }, nextRow: { flexDirection: "row", gap: 10, marginTop: 18 }, nextBox: { flex: 1, padding: 11, borderRadius: 12, backgroundColor: "rgba(217,178,104,.14)", borderWidth: 1, borderColor: "rgba(217,178,104,.28)" }, nextLabel: { color: RR.goldLight, fontSize: 9, fontWeight: "700", letterSpacing: 1 }, nextValue: { color: RR.cream, fontSize: 13, fontWeight: "600", marginTop: 4 }, arrow: { width: 46, borderRadius: 12, backgroundColor: RR.goldLight, alignItems: "center", justifyContent: "center" }, arrowText: { fontSize: 22, color: RR.forest }, aiCard: { marginTop: 14, padding: 14, borderRadius: 18, backgroundColor: RR.white, borderWidth: 1, borderColor: RR.line, flexDirection: "row", gap: 12, alignItems: "center" }, aiIcon: { width: 35, height: 35, borderRadius: 18, backgroundColor: RR.gold, alignItems: "center", justifyContent: "center" }, spark: { color: "#fff", fontSize: 17 }, aiLabel: { color: RR.muted, fontSize: 9, letterSpacing: 1 }, aiText: { color: RR.forest, fontSize: 14, marginTop: 2 }, sun: { color: RR.gold, fontSize: 22 }, section: { marginTop: 22, marginBottom: 10, color: RR.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }, shortcuts: { flexDirection: "row", gap: 10 }, shortcut: { flex: 1, backgroundColor: RR.white, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: RR.line }, shortcutIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(184,135,58,.12)", justifyContent: "center", alignItems: "center", marginBottom: 9 }, shortcutGlyph: { color: RR.gold, fontSize: 20 }, shortcutTitle: { color: RR.forest, fontWeight: "700", fontSize: 14 }, shortcutSub: { color: RR.muted, fontSize: 11, marginTop: 2 }, pending: { marginTop: 14, padding: 12, borderRadius: 13, backgroundColor: RR.white, borderWidth: 1, borderColor: RR.line, flexDirection: "row", alignItems: "center", gap: 10 }, pendingBar: { width: 5, height: 30, backgroundColor: RR.gold, borderRadius: 3 }, pendingTitle: { color: RR.forest, fontWeight: "700", fontSize: 13 }, pendingSub: { color: RR.muted, fontSize: 11, marginTop: 2 }, pendingArrow: { color: RR.gold, fontWeight: "700", fontSize: 11 } });
