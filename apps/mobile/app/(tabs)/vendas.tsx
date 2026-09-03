import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authenticatedFetch, hasSession } from "../../services/auth";
import { API_URL } from "../../config/env";
import { RR } from "../../config/theme";

type PaymentMethod =
  | "pix"
  | "dinheiro"
  | "cartao_credito"
  | "cartao_debito"
  | "transferencia"
  | "boleto"
  | "outro";

interface Sale {
  id: string;
  client_name: string;
  client_document: string | null;
  client_phone: string | null;
  item_name: string;
  amount_cents: number;
  payment_method: PaymentMethod | null;
  installments: number;
  sale_date: string;
  notes: string | null;
  contract_generated_at: string | null;
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

export default function VendasScreen() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      if (!(await hasSession())) {
        setError("Entre com o Google para ver suas vendas.");
        return;
      }
      const res = await authenticatedFetch("/sales");
      if (!res.ok) throw new Error("Falha ao carregar vendas");
      setSales(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function downloadContract(sale: Sale) {
    setDownloadingId(sale.id);
    try {
      // Contract PDF endpoint requires auth. Open in system browser via
      // authenticated URL by first fetching (to prove token) then handing
      // off the raw URL — device browser will attempt again without auth,
      // so we instead alert with a copyable link.
      Alert.alert(
        "Contrato PDF",
        "O contrato precisa ser baixado pela web. Abrir no navegador do sistema? (você precisará estar logado lá também)",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Abrir",
            onPress: () => Linking.openURL(`${API_URL}/sales/${sale.id}/contract`),
          },
        ]
      );
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <SafeAreaView style={s.root} edges={["bottom"]}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>NEGÓCIOS</Text>
          <Text style={s.title}>Vendas</Text>
        </View>
        <View style={s.total}>
          <Text style={s.totalText}>{sales.length}</Text>
        </View>
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
          {error ? (
            <View style={s.notice}>
              <Text style={s.noticeTitle}>Ops</Text>
              <Text style={s.muted}>{error}</Text>
            </View>
          ) : sales.length === 0 ? (
            <View style={s.notice}>
              <Text style={s.noticeTitle}>Nenhuma venda ainda</Text>
              <Text style={s.muted}>
                Registre vendas pela web ou pelo assistente de IA — elas aparecem aqui.
              </Text>
            </View>
          ) : (
            sales.map((sale) => (
              <View key={sale.id} style={s.card}>
                <View style={s.rowTop}>
                  <Text style={s.client}>{sale.client_name}</Text>
                  <Text style={s.amount}>{formatBRL(sale.amount_cents)}</Text>
                </View>
                <Text style={s.item}>{sale.item_name}</Text>
                <View style={s.meta}>
                  <Text style={s.metaText}>{formatDate(sale.sale_date)}</Text>
                  <Text style={s.metaDot}>·</Text>
                  <Text style={s.metaText}>
                    {sale.payment_method
                      ? METHOD_LABELS[sale.payment_method]
                      : "A combinar"}
                    {sale.installments > 1 ? ` · ${sale.installments}x` : ""}
                  </Text>
                </View>
                {sale.notes && <Text style={s.notes}>{sale.notes}</Text>}
                <TouchableOpacity
                  style={[s.pdfBtn, sale.contract_generated_at && s.pdfBtnDone]}
                  onPress={() => downloadContract(sale)}
                  disabled={downloadingId === sale.id}
                >
                  {downloadingId === sale.id ? (
                    <ActivityIndicator size="small" color={RR.gold} />
                  ) : (
                    <Text style={s.pdfBtnText}>
                      {sale.contract_generated_at
                        ? "✓ Baixar contrato novamente"
                        : "Gerar contrato PDF"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: RR.ivory },
  header: {
    padding: 20,
    paddingTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: { color: RR.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  title: { color: RR.forest, fontFamily: "serif", fontSize: 32, marginTop: 2 },
  total: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: RR.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  totalText: { color: RR.goldLight, fontWeight: "700" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
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
  muted: { color: RR.muted, textAlign: "center", lineHeight: 20, fontSize: 14 },
  card: {
    backgroundColor: RR.white,
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: RR.line,
    gap: 6,
  },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  client: { color: RR.forest, fontSize: 16, fontWeight: "700", flex: 1 },
  amount: { color: RR.gold, fontSize: 17, fontWeight: "700", fontVariant: ["tabular-nums"] },
  item: { color: RR.body, fontSize: 14 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  metaText: { color: RR.muted, fontSize: 12 },
  metaDot: { color: RR.muted, fontSize: 12 },
  notes: { color: RR.muted, fontSize: 13, fontStyle: "italic", marginTop: 4 },
  pdfBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: RR.gold,
    alignItems: "center",
  },
  pdfBtnDone: { backgroundColor: "rgba(107,143,94,0.10)", borderColor: RR.leaf },
  pdfBtnText: { color: RR.forest, fontSize: 13, fontWeight: "600" },
});
