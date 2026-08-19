import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authenticatedFetch } from "../../services/auth";

type Status = "pending" | "confirmed" | "rejected" | "canceled";
type Request = {
  id: string;
  session_type_name: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  client_notes: string | null;
  requested_start: string;
  requested_end: string;
  status: Status;
  responded_reason: string | null;
};

const C = { primary: "#5E4B37", gold: "#C4A265", bg: "#FBF8F3", surface: "#FFFFFF", text: "#2C2418", muted: "#8B8078", border: "#E8E0D4", green: "#52734D", red: "#A44A3F" };

function when(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Cuiaba" }).format(new Date(iso));
}

export default function AgendamentosScreen() {
  const [items, setItems] = useState<Request[]>([]);
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const response = await authenticatedFetch("/booking/requests");
      if (response.status === 401) throw new Error("Entre com Google para acessar os pedidos.");
      if (!response.ok) throw new Error("Não foi possível carregar os pedidos.");
      setItems(await response.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar os pedidos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => items.filter((item) => tab === "pending" ? item.status === "pending" : item.status !== "pending"), [items, tab]);
  const pending = items.filter((item) => item.status === "pending").length;

  async function respond(item: Request, action: "confirm" | "reject") {
    const label = action === "confirm" ? "aprovar" : "recusar";
    Alert.alert(`${label[0].toUpperCase()}${label.slice(1)} pedido`, `${item.client_name} · ${when(item.requested_start)}`, [
      { text: "Cancelar", style: "cancel" },
      { text: action === "confirm" ? "Aprovar" : "Recusar", style: action === "reject" ? "destructive" : "default", onPress: async () => {
        setBusy(item.id);
        try {
          const response = await authenticatedFetch(`/booking/requests/${item.id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: action === "reject" ? JSON.stringify({ reason: "Recusado pelo aplicativo" }) : undefined });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o pedido.");
          await load(true);
        } catch (e) {
          Alert.alert("Não foi possível concluir", e instanceof Error ? e.message : "Tente novamente.");
        } finally { setBusy(null); }
      } },
    ]);
  }

  return (
    <SafeAreaView style={s.container} edges={["bottom"]}>
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab === "pending" && s.tabActive]} onPress={() => setTab("pending")}><Text style={[s.tabText, tab === "pending" && s.tabTextActive]}>Pendentes {pending > 0 ? `(${pending})` : ""}</Text></TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === "history" && s.tabActive]} onPress={() => setTab("history")}><Text style={[s.tabText, tab === "history" && s.tabTextActive]}>Histórico</Text></TouchableOpacity>
      </View>
      {loading ? <View style={s.center}><ActivityIndicator color={C.gold} /><Text style={s.muted}>Carregando pedidos...</Text></View> : (
        <ScrollView contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.gold} />}>
          {error ? <View style={s.notice}><Text style={s.noticeTitle}>Acesso necessário</Text><Text style={s.muted}>{error}</Text><TouchableOpacity style={s.retry} onPress={() => load()}><Text style={s.retryText}>Tentar novamente</Text></TouchableOpacity></View> : null}
          {!error && visible.length === 0 ? <View style={s.notice}><Text style={s.noticeTitle}>{tab === "pending" ? "Tudo em dia" : "Nenhum histórico"}</Text><Text style={s.muted}>{tab === "pending" ? "Não há solicitações aguardando resposta." : "Os pedidos respondidos aparecerão aqui."}</Text></View> : null}
          {visible.map((item) => <View key={item.id} style={s.card}>
            <View style={s.cardTop}><Text style={s.name}>{item.client_name}</Text><View style={[s.badge, item.status !== "pending" && s.badgeMuted]}><Text style={s.badgeText}>{item.status === "pending" ? "PENDENTE" : item.status === "confirmed" ? "CONFIRMADO" : item.status === "rejected" ? "RECUSADO" : "CANCELADO"}</Text></View></View>
            <Text style={s.type}>{item.session_type_name}</Text><Text style={s.date}>{when(item.requested_start)}</Text>
            <Text style={s.contact}>{item.client_phone || item.client_email}</Text>
            {item.client_notes ? <Text style={s.notes}>{item.client_notes}</Text> : null}
            {item.status === "pending" ? <View style={s.actions}><TouchableOpacity style={s.reject} disabled={busy === item.id} onPress={() => respond(item, "reject")}><Text style={s.rejectText}>Recusar</Text></TouchableOpacity><TouchableOpacity style={s.confirm} disabled={busy === item.id} onPress={() => respond(item, "confirm")}>{busy === item.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.confirmText}>Aprovar</Text>}</TouchableOpacity></View> : null}
          </View>)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg }, tabs: { flexDirection: "row", backgroundColor: C.surface, padding: 8, borderBottomWidth: 1, borderBottomColor: C.border }, tab: { flex: 1, padding: 10, borderRadius: 9, alignItems: "center" }, tabActive: { backgroundColor: C.bg }, tabText: { color: C.muted, fontSize: 13, fontWeight: "600" }, tabTextActive: { color: C.primary }, list: { padding: 16, gap: 12, paddingBottom: 32 }, center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 }, muted: { color: C.muted, fontSize: 14, textAlign: "center", lineHeight: 20 }, notice: { backgroundColor: C.surface, padding: 24, borderRadius: 14, alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.border }, noticeTitle: { color: C.primary, fontFamily: "serif", fontSize: 18, fontWeight: "600" }, retry: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: C.primary, borderRadius: 9 }, retryText: { color: "#fff", fontWeight: "600" }, card: { backgroundColor: C.surface, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: C.border, gap: 5 }, cardTop: { flexDirection: "row", alignItems: "center", gap: 8 }, name: { flex: 1, color: C.text, fontSize: 17, fontWeight: "600" }, badge: { backgroundColor: "#FFF1CF", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }, badgeMuted: { backgroundColor: C.bg }, badgeText: { color: C.primary, fontSize: 9, fontWeight: "700" }, type: { color: C.gold, fontSize: 13, fontWeight: "600" }, date: { color: C.text, fontSize: 14, marginTop: 4, textTransform: "capitalize" }, contact: { color: C.muted, fontSize: 13 }, notes: { color: C.muted, fontSize: 13, fontStyle: "italic", paddingTop: 5 }, actions: { flexDirection: "row", gap: 10, marginTop: 12 }, reject: { flex: 1, padding: 12, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: C.red }, rejectText: { color: C.red, fontWeight: "600" }, confirm: { flex: 1, padding: 12, alignItems: "center", borderRadius: 10, backgroundColor: C.green }, confirmText: { color: "#fff", fontWeight: "600" },
});
