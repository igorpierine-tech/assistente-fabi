import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authenticatedFetch, hasSession } from "../../services/auth";
import { RR } from "../../config/theme";

type Status = "pendente" | "pago" | "cancelado";
type PaymentMethod =
  | "pix"
  | "dinheiro"
  | "cartao_credito"
  | "cartao_debito"
  | "transferencia"
  | "boleto"
  | "outro";

interface Receivable {
  id: string;
  client_name: string;
  item_name: string;
  amount_cents: number;
  service_date: string;
  due_date: string;
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  status: Status;
  notes: string | null;
}

interface Summary {
  a_receber_cents: number;
  recebido_mes_cents: number;
  em_atraso_cents: number;
  a_receber_count: number;
  em_atraso_count: number;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
  boleto: "Boleto",
  outro: "Outro",
};

const METHOD_OPTIONS: PaymentMethod[] = [
  "pix",
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "transferencia",
  "boleto",
  "outro",
];

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Cuiaba",
  });
}

function isOverdue(r: Receivable): boolean {
  if (r.status !== "pendente") return false;
  const today = new Date().toISOString().slice(0, 10);
  return r.due_date.slice(0, 10) < today;
}

type Filter = "todos" | "pendentes" | "atrasados" | "pagos";

export default function FinanceiroScreen() {
  const [items, setItems] = useState<Receivable[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("todos");
  const [paying, setPaying] = useState<Receivable | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      if (!(await hasSession())) return;
      const [listRes, sumRes] = await Promise.all([
        authenticatedFetch("/receivables"),
        authenticatedFetch("/receivables/summary"),
      ]);
      if (listRes.ok) setItems(await listRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((r) => {
    if (filter === "pendentes") return r.status === "pendente" && !isOverdue(r);
    if (filter === "atrasados") return isOverdue(r);
    if (filter === "pagos") return r.status === "pago";
    return true;
  });

  async function markPaid() {
    if (!paying) return;
    setBusy(true);
    try {
      const res = await authenticatedFetch(`/receivables/${paying.id}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: method,
          paidAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Erro", err.error || "Não foi possível marcar como pago.");
        return;
      }
      setPaying(null);
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.root} edges={["bottom"]}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>CONTAS A RECEBER</Text>
          <Text style={s.title}>Financeiro</Text>
        </View>
      </View>

      {summary && (
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>A RECEBER</Text>
            <Text style={s.summaryValue}>{formatBRL(summary.a_receber_cents)}</Text>
            <Text style={s.summarySub}>{summary.a_receber_count} lançamento(s)</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>EM ATRASO</Text>
            <Text style={[s.summaryValue, s.summaryDanger]}>
              {formatBRL(summary.em_atraso_cents)}
            </Text>
            <Text style={s.summarySub}>{summary.em_atraso_count} vencido(s)</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>RECEBIDO</Text>
            <Text style={[s.summaryValue, s.summaryGood]}>
              {formatBRL(summary.recebido_mes_cents)}
            </Text>
            <Text style={s.summarySub}>no mês</Text>
          </View>
        </View>
      )}

      <View style={s.tabs}>
        {(["todos", "pendentes", "atrasados", "pagos"] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.tab, filter === f && s.tabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.tabText, filter === f && s.tabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={RR.gold} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={RR.gold}
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={s.notice}>
              <Text style={s.noticeTitle}>Nada por aqui</Text>
              <Text style={s.muted}>
                Nenhum lançamento neste filtro.
              </Text>
            </View>
          ) : (
            filtered.map((r) => {
              const overdue = isOverdue(r);
              const statusLabel = overdue
                ? "Atrasado"
                : r.status.charAt(0).toUpperCase() + r.status.slice(1);
              return (
                <View key={r.id} style={s.card}>
                  <View style={s.rowTop}>
                    <Text style={s.client}>{r.client_name}</Text>
                    <Text style={s.amount}>{formatBRL(r.amount_cents)}</Text>
                  </View>
                  <Text style={s.item}>{r.item_name}</Text>
                  <View style={s.metaRow}>
                    <Text style={s.metaText}>{formatDate(r.service_date)}</Text>
                    <View
                      style={[
                        s.badge,
                        overdue
                          ? s.badgeDanger
                          : r.status === "pago"
                          ? s.badgeGood
                          : r.status === "cancelado"
                          ? s.badgeMuted
                          : s.badgePending,
                      ]}
                    >
                      <Text style={s.badgeText}>{statusLabel}</Text>
                    </View>
                  </View>
                  {r.payment_method && (
                    <Text style={s.methodText}>
                      Pagamento: {METHOD_LABELS[r.payment_method]}
                    </Text>
                  )}
                  {r.status !== "pago" && (
                    <TouchableOpacity
                      style={s.payBtn}
                      onPress={() => {
                        setPaying(r);
                        setMethod(r.payment_method || "pix");
                      }}
                    >
                      <Text style={s.payBtnText}>Marcar como pago</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal visible={!!paying} transparent animationType="slide" onRequestClose={() => setPaying(null)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Registrar pagamento</Text>
            {paying && (
              <Text style={s.sheetSub}>
                {paying.client_name} · {paying.item_name}
                {"\n"}
                <Text style={{ color: RR.gold, fontWeight: "700" }}>
                  {formatBRL(paying.amount_cents)}
                </Text>
              </Text>
            )}
            <Text style={s.sheetLabel}>FORMA DE PAGAMENTO</Text>
            <View style={s.methodGrid}>
              {METHOD_OPTIONS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[s.methodOpt, method === m && s.methodOptActive]}
                  onPress={() => setMethod(m)}
                >
                  <Text
                    style={[
                      s.methodOptText,
                      method === m && s.methodOptTextActive,
                    ]}
                  >
                    {METHOD_LABELS[m]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.sheetActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setPaying(null)}>
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={markPaid} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color={RR.forest} />
                ) : (
                  <Text style={s.confirmBtnText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: RR.ivory },
  header: { padding: 20, paddingTop: 18 },
  eyebrow: { color: RR.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  title: { color: RR.forest, fontFamily: "serif", fontSize: 32, marginTop: 2 },
  summaryRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: RR.white,
    borderWidth: 1,
    borderColor: RR.line,
  },
  summaryLabel: { color: RR.muted, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  summaryValue: {
    color: RR.forest,
    fontFamily: "serif",
    fontSize: 18,
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  summaryDanger: { color: "#c04a2a" },
  summaryGood: { color: "#3f6635" },
  summarySub: { color: RR.muted, fontSize: 10, marginTop: 2 },
  tabs: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: RR.line,
    marginBottom: 8,
  },
  tab: { paddingHorizontal: 10, paddingVertical: 8 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: RR.gold, marginBottom: -1 },
  tabText: { color: RR.muted, fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: RR.forest },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 10, paddingBottom: 32 },
  notice: {
    backgroundColor: RR.white,
    padding: 24,
    borderRadius: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: RR.line,
  },
  noticeTitle: { color: RR.forest, fontFamily: "serif", fontSize: 18 },
  muted: { color: RR.muted, textAlign: "center", fontSize: 14 },
  card: {
    backgroundColor: RR.white,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RR.line,
    gap: 5,
  },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  client: { color: RR.forest, fontSize: 15, fontWeight: "700", flex: 1 },
  amount: { color: RR.gold, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  item: { color: RR.body, fontSize: 13 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  metaText: { color: RR.muted, fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  badgePending: { backgroundColor: "rgba(184,135,58,0.15)" },
  badgeGood: { backgroundColor: "rgba(107,143,94,0.2)" },
  badgeDanger: { backgroundColor: "rgba(192,74,42,0.15)" },
  badgeMuted: { backgroundColor: "rgba(107,97,82,0.2)" },
  methodText: { color: RR.muted, fontSize: 12, marginTop: 2 },
  payBtn: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: RR.forest,
    alignItems: "center",
  },
  payBtnText: { color: RR.goldLight, fontWeight: "700", fontSize: 13 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: RR.ivory,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  sheetTitle: { color: RR.forest, fontFamily: "serif", fontSize: 20 },
  sheetSub: { color: RR.body, fontSize: 13, marginTop: 6, lineHeight: 20 },
  sheetLabel: {
    color: RR.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  methodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  methodOpt: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: RR.line,
    backgroundColor: RR.white,
  },
  methodOptActive: { backgroundColor: RR.forest, borderColor: RR.forest },
  methodOptText: { color: RR.forest, fontSize: 13, fontWeight: "600" },
  methodOptTextActive: { color: RR.goldLight },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: RR.line,
    alignItems: "center",
  },
  cancelBtnText: { color: RR.forest, fontWeight: "600" },
  confirmBtn: {
    flex: 2,
    padding: 12,
    borderRadius: 10,
    backgroundColor: RR.goldLight,
    alignItems: "center",
  },
  confirmBtnText: { color: RR.forest, fontWeight: "700" },
});
