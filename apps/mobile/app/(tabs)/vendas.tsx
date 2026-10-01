import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authenticatedFetch, hasSession } from "../../services/auth";
import { API_URL } from "../../config/env";
import { RR } from "../../config/theme";

type PaymentMethod = "pix" | "dinheiro" | "cartao_credito" | "cartao_debito" | "transferencia" | "boleto" | "outro";

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

interface ClientOption { id: string; name: string; phone: string | null; email: string | null; document: string | null; }

const METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX", dinheiro: "Dinheiro", cartao_credito: "Cartão crédito", cartao_debito: "Cartão débito",
  transferencia: "Transferência", boleto: "Boleto", outro: "Outro",
};

const METHODS = Object.keys(METHOD_LABELS) as PaymentMethod[];

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Cuiaba" });
}

const EMPTY_FORM = { clientName: "", clientId: "", itemName: "", amount: "", paymentMethod: "" as string, installments: "1", notes: "" };

export default function VendasScreen() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      if (!(await hasSession())) { setError("Faça login para ver suas vendas."); return; }
      const res = await authenticatedFetch("/sales");
      if (!res.ok) throw new Error("Falha ao carregar vendas");
      setSales(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openCreate() {
    setForm(EMPTY_FORM);
    setShowCreate(true);
    try {
      const r = await authenticatedFetch("/clients");
      if (r.ok) setClients(await r.json());
    } catch {}
  }

  function selectClient(id: string) {
    const c = clients.find((cl) => cl.id === id);
    setForm((f) => ({ ...f, clientId: id, clientName: c?.name || f.clientName }));
  }

  async function handleCreate() {
    if (!form.clientName.trim() || !form.itemName.trim()) {
      Alert.alert("Campos obrigatórios", "Informe o nome do cliente e o item vendido.");
      return;
    }
    setSaving(true);
    try {
      const amountVal = form.amount.replace(/\./g, "").replace(",", ".");
      const res = await authenticatedFetch("/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: form.clientId || undefined,
          clientName: form.clientName.trim(),
          itemName: form.itemName.trim(),
          amountCents: Math.round(Number(amountVal) * 100) || 0,
          paymentMethod: form.paymentMethod || undefined,
          installments: parseInt(form.installments) || 1,
          notes: form.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao registrar venda");
      }
      setShowCreate(false);
      load(true);
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Tente novamente");
    } finally { setSaving(false); }
  }

  function downloadContract(sale: Sale) {
    setDownloadingId(sale.id);
    Alert.alert("Contrato PDF", "Abrir no navegador?", [
      { text: "Cancelar", style: "cancel", onPress: () => setDownloadingId(null) },
      { text: "Abrir", onPress: () => { Linking.openURL(`${API_URL}/sales/${sale.id}/contract`); setDownloadingId(null); } },
    ]);
  }

  return (
    <SafeAreaView style={s.root} edges={["bottom"]}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>NEGÓCIOS</Text>
          <Text style={s.title}>Vendas</Text>
        </View>
        <View style={s.total}><Text style={s.totalText}>{sales.length}</Text></View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={RR.gold} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={RR.gold} />}
        >
          {error ? (
            <View style={s.notice}><Text style={s.noticeTitle}>Ops</Text><Text style={s.muted}>{error}</Text></View>
          ) : sales.length === 0 ? (
            <View style={s.notice}>
              <Text style={s.noticeTitle}>Nenhuma venda ainda</Text>
              <Text style={s.muted}>Toque no + para registrar a primeira venda.</Text>
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
                    {sale.payment_method ? METHOD_LABELS[sale.payment_method] : "A combinar"}
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
                      {sale.contract_generated_at ? "✓ Baixar contrato novamente" : "Gerar contrato PDF"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={openCreate}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetTop}>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={s.close}>‹</Text>
              </TouchableOpacity>
              <Text style={s.sheetLabel}>NOVA VENDA</Text>
              <View style={{ width: 40 }} />
            </View>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
                {clients.length > 0 && (
                  <>
                    <Text style={s.fieldLabel}>Cliente cadastrado</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <TouchableOpacity
                          style={[s.chip, !form.clientId && s.chipActive]}
                          onPress={() => setForm((f) => ({ ...f, clientId: "" }))}
                        >
                          <Text style={[s.chipText, !form.clientId && s.chipTextActive]}>Manual</Text>
                        </TouchableOpacity>
                        {clients.map((c) => (
                          <TouchableOpacity
                            key={c.id}
                            style={[s.chip, form.clientId === c.id && s.chipActive]}
                            onPress={() => selectClient(c.id)}
                          >
                            <Text style={[s.chipText, form.clientId === c.id && s.chipTextActive]}>{c.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </>
                )}

                <Text style={s.fieldLabel}>Nome do cliente *</Text>
                <TextInput style={s.fieldInput} value={form.clientName} onChangeText={(v) => setForm({ ...form, clientName: v })} placeholder="Nome completo" placeholderTextColor={RR.muted} />

                <Text style={s.fieldLabel}>Item / Serviço *</Text>
                <TextInput style={s.fieldInput} value={form.itemName} onChangeText={(v) => setForm({ ...form, itemName: v })} placeholder="Ex: Mentoria, Consultoria" placeholderTextColor={RR.muted} />

                <Text style={s.fieldLabel}>Valor (R$)</Text>
                <TextInput style={s.fieldInput} value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} placeholder="0,00" placeholderTextColor={RR.muted} keyboardType="decimal-pad" />

                <Text style={s.fieldLabel}>Forma de pagamento</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {METHODS.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[s.chip, form.paymentMethod === m && s.chipActive]}
                        onPress={() => setForm({ ...form, paymentMethod: form.paymentMethod === m ? "" : m })}
                      >
                        <Text style={[s.chipText, form.paymentMethod === m && s.chipTextActive]}>{METHOD_LABELS[m]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <Text style={s.fieldLabel}>Parcelas</Text>
                <TextInput style={s.fieldInput} value={form.installments} onChangeText={(v) => setForm({ ...form, installments: v })} keyboardType="number-pad" />

                <Text style={s.fieldLabel}>Observações</Text>
                <TextInput style={[s.fieldInput, { minHeight: 70, textAlignVertical: "top" }]} value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} placeholder="Notas opcionais" placeholderTextColor={RR.muted} multiline />

                <TouchableOpacity style={s.saveBtn} onPress={handleCreate} disabled={saving}>
                  {saving ? <ActivityIndicator color={RR.goldLight} /> : <Text style={s.saveBtnText}>Registrar venda</Text>}
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: RR.ivory },
  header: { padding: 20, paddingTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: RR.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  title: { color: RR.forest, fontFamily: "serif", fontSize: 32, marginTop: 2 },
  total: { width: 38, height: 38, borderRadius: 19, backgroundColor: RR.forest, alignItems: "center", justifyContent: "center" },
  totalText: { color: RR.goldLight, fontWeight: "700" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 12, paddingBottom: 80 },
  notice: { backgroundColor: RR.white, padding: 24, borderRadius: 14, alignItems: "center", gap: 6, borderWidth: 1, borderColor: RR.line },
  noticeTitle: { color: RR.forest, fontFamily: "serif", fontSize: 18 },
  muted: { color: RR.muted, textAlign: "center", lineHeight: 20, fontSize: 14 },
  card: { backgroundColor: RR.white, padding: 15, borderRadius: 14, borderWidth: 1, borderColor: RR.line, gap: 6 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  client: { color: RR.forest, fontSize: 16, fontWeight: "700", flex: 1 },
  amount: { color: RR.gold, fontSize: 17, fontWeight: "700", fontVariant: ["tabular-nums"] },
  item: { color: RR.body, fontSize: 14 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  metaText: { color: RR.muted, fontSize: 12 },
  metaDot: { color: RR.muted, fontSize: 12 },
  notes: { color: RR.muted, fontSize: 13, fontStyle: "italic", marginTop: 4 },
  pdfBtn: { marginTop: 10, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: RR.gold, alignItems: "center" },
  pdfBtnDone: { backgroundColor: "rgba(107,143,94,0.10)", borderColor: RR.leaf },
  pdfBtnText: { color: RR.forest, fontSize: 13, fontWeight: "600" },
  fab: {
    position: "absolute", right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: RR.forest, alignItems: "center", justifyContent: "center",
    elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5,
  },
  fabText: { color: RR.goldLight, fontSize: 28, fontWeight: "300", marginTop: -2 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,.35)", justifyContent: "flex-end" },
  sheet: { maxHeight: "92%", minHeight: "60%", backgroundColor: RR.ivory, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingBottom: 24 },
  sheetTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18 },
  close: { color: RR.forest, fontSize: 32 },
  sheetLabel: { color: RR.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.4 },
  fieldLabel: { color: RR.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  fieldInput: { backgroundColor: RR.white, borderWidth: 1, borderColor: RR.line, borderRadius: 12, padding: 13, fontSize: 15, color: RR.ink },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: RR.line, backgroundColor: RR.white },
  chipActive: { backgroundColor: RR.forest, borderColor: RR.forest },
  chipText: { color: RR.body, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: RR.goldLight },
  saveBtn: { padding: 16, borderRadius: 12, backgroundColor: RR.forest, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: RR.goldLight, fontWeight: "700", fontSize: 15 },
});
