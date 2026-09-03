import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  kind: "produto" | "servico";
  price_cents: number;
  duration_minutes: number | null;
  active: number;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CatalogoScreen() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      if (!(await hasSession())) return;
      const res = await authenticatedFetch("/catalog");
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(item: CatalogItem) {
    const res = await authenticatedFetch(`/catalog/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    if (res.ok) {
      await load(true);
    } else {
      Alert.alert("Erro", "Não foi possível atualizar.");
    }
  }

  const services = items.filter((i) => i.kind === "servico");
  const products = items.filter((i) => i.kind === "produto");

  function renderCard(item: CatalogItem) {
    return (
      <View key={item.id} style={[s.card, !item.active && s.cardInactive]}>
        <View style={s.rowTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{item.name}</Text>
            {item.description && <Text style={s.desc}>{item.description}</Text>}
          </View>
          <Text style={s.price}>{formatBRL(item.price_cents)}</Text>
        </View>
        <View style={s.metaRow}>
          {item.duration_minutes && (
            <Text style={s.metaText}>{item.duration_minutes} min</Text>
          )}
          <TouchableOpacity
            style={[s.toggle, item.active ? s.toggleOn : s.toggleOff]}
            onPress={() => toggleActive(item)}
          >
            <Text style={s.toggleText}>
              {item.active ? "Ativo · toque para desativar" : "Inativo · toque para ativar"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["bottom"]}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>CATÁLOGO</Text>
          <Text style={s.title}>Produtos e serviços</Text>
        </View>
        <View style={s.total}>
          <Text style={s.totalText}>{items.length}</Text>
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
          {items.length === 0 ? (
            <View style={s.notice}>
              <Text style={s.noticeTitle}>Sem itens ainda</Text>
              <Text style={s.muted}>
                Cadastre produtos e serviços pela web (Configurações → Produtos e serviços)
                ou peça ao assistente de IA. Só serviços ATIVOS com duração definida
                aparecem na página pública de agendamento.
              </Text>
            </View>
          ) : (
            <>
              {services.length > 0 && (
                <>
                  <Text style={s.section}>SERVIÇOS</Text>
                  {services.map(renderCard)}
                </>
              )}
              {products.length > 0 && (
                <>
                  <Text style={s.section}>PRODUTOS</Text>
                  {products.map(renderCard)}
                </>
              )}
            </>
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
  title: { color: RR.forest, fontFamily: "serif", fontSize: 26, marginTop: 2 },
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
  list: { padding: 16, gap: 10, paddingBottom: 32 },
  section: {
    color: RR.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginTop: 8,
    marginBottom: 2,
  },
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
  muted: { color: RR.muted, textAlign: "center", lineHeight: 20, fontSize: 13 },
  card: {
    backgroundColor: RR.white,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RR.line,
    gap: 8,
  },
  cardInactive: { opacity: 0.5 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  name: { color: RR.forest, fontSize: 15, fontWeight: "700" },
  desc: { color: RR.muted, fontSize: 12, marginTop: 2 },
  price: { color: RR.gold, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  metaText: { color: RR.muted, fontSize: 12 },
  toggle: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  toggleOn: { backgroundColor: "rgba(107,143,94,0.15)" },
  toggleOff: { backgroundColor: "rgba(107,97,82,0.15)" },
  toggleText: { color: RR.forest, fontSize: 11, fontWeight: "600" },
});
