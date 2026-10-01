import { useCallback, useEffect, useMemo, useState } from "react";
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
import { authenticatedFetch } from "../../services/auth";
import { RR } from "../../config/theme";

type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  notes: string | null;
  tipo_pessoa: string | null;
  address: string | null;
  created_at?: string;
};

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return `${p[0]?.[0] || ""}${p.length > 1 ? p[p.length - 1][0] : ""}`.toUpperCase();
}

const EMPTY_FORM = { name: "", phone: "", email: "", document: "", notes: "", tipo_pessoa: "PF", address: "" };

export default function ClientesScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const r = await authenticatedFetch("/clients");
      if (r.ok) setClients(await r.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => clients.filter((c) => `${c.name} ${c.phone || ""} ${c.email || ""}`.toLowerCase().includes(search.toLowerCase())),
    [clients, search],
  );

  function openCreate() {
    setForm(EMPTY_FORM);
    setShowCreate(true);
  }

  function openEdit() {
    if (!selected) return;
    setForm({
      name: selected.name,
      phone: selected.phone || "",
      email: selected.email || "",
      document: selected.document || "",
      notes: selected.notes || "",
      tipo_pessoa: selected.tipo_pessoa || "PF",
      address: selected.address || "",
    });
    setEditing(true);
  }

  async function handleSave() {
    const isEdit = editing && selected;
    const name = form.name.trim();
    if (!name) { Alert.alert("Nome obrigatório"); return; }
    setSaving(true);
    try {
      const body = {
        name,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        document: form.document.trim() || undefined,
        notes: form.notes.trim() || undefined,
        tipo_pessoa: form.tipo_pessoa || undefined,
        address: form.address.trim() || undefined,
      };
      const url = isEdit ? `/clients/${selected.id}` : "/clients";
      const res = await authenticatedFetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao salvar cliente");
      }
      const saved = await res.json();
      if (isEdit) {
        setClients((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
        setSelected(saved);
      } else {
        setClients((prev) => [saved, ...prev]);
      }
      setShowCreate(false);
      setEditing(false);
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Tente novamente");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!selected) return;
    Alert.alert("Excluir cliente", `Tem certeza que deseja excluir ${selected.name}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          const res = await authenticatedFetch(`/clients/${selected.id}`, { method: "DELETE" });
          if (res.ok || res.status === 204) {
            setClients((prev) => prev.filter((c) => c.id !== selected.id));
            setSelected(null);
          } else {
            Alert.alert("Erro ao excluir");
          }
        },
      },
    ]);
  }

  function renderForm() {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          <Text style={s.fieldLabel}>Nome *</Text>
          <TextInput style={s.fieldInput} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Nome completo" placeholderTextColor={RR.muted} />

          <Text style={s.fieldLabel}>Telefone</Text>
          <TextInput style={s.fieldInput} value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder="(65) 99999-0000" placeholderTextColor={RR.muted} keyboardType="phone-pad" />

          <Text style={s.fieldLabel}>E-mail</Text>
          <TextInput style={s.fieldInput} value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} placeholder="cliente@email.com" placeholderTextColor={RR.muted} keyboardType="email-address" autoCapitalize="none" />

          <Text style={s.fieldLabel}>CPF / CNPJ</Text>
          <TextInput style={s.fieldInput} value={form.document} onChangeText={(v) => setForm({ ...form, document: v })} placeholder="000.000.000-00" placeholderTextColor={RR.muted} keyboardType="numeric" />

          <Text style={s.fieldLabel}>Endereço</Text>
          <TextInput style={s.fieldInput} value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} placeholder="Rua, número, bairro" placeholderTextColor={RR.muted} />

          <Text style={s.fieldLabel}>Tipo de pessoa</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {["PF", "PJ"].map((tp) => (
              <TouchableOpacity
                key={tp}
                style={[s.tpBtn, form.tipo_pessoa === tp && s.tpBtnActive]}
                onPress={() => setForm({ ...form, tipo_pessoa: tp })}
              >
                <Text style={[s.tpText, form.tipo_pessoa === tp && s.tpTextActive]}>{tp === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.fieldLabel}>Observações</Text>
          <TextInput
            style={[s.fieldInput, { minHeight: 80, textAlignVertical: "top" }]}
            value={form.notes}
            onChangeText={(v) => setForm({ ...form, notes: v })}
            placeholder="Anotações sobre o cliente"
            placeholderTextColor={RR.muted}
            multiline
          />

          <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={RR.goldLight} /> : <Text style={s.saveBtnText}>{editing ? "Salvar alterações" : "Cadastrar cliente"}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["bottom"]}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>RELACIONAMENTOS</Text>
          <Text style={s.title}>Clientes</Text>
        </View>
        <View style={s.total}>
          <Text style={s.totalText}>{clients.length}</Text>
        </View>
      </View>

      <View style={s.search}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome ou contato"
          placeholderTextColor={RR.muted}
          style={s.input}
        />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={RR.gold} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={RR.gold} />}
        >
          {visible.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>Nenhum cliente encontrado</Text>
              <Text style={s.emptyText}>Os clientes cadastrados aparecerão aqui.</Text>
            </View>
          ) : (
            visible.map((client) => (
              <TouchableOpacity key={client.id} style={s.row} onPress={() => setSelected(client)}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{initials(client.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.clientName}>{client.name}</Text>
                  <Text style={s.clientContact}>{client.phone || client.email || "Sem contato"}</Text>
                </View>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={openCreate}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      {/* Detail / Edit Sheet */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => { setSelected(null); setEditing(false); }}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetTop}>
              <TouchableOpacity onPress={() => { if (editing) { setEditing(false); } else { setSelected(null); } }}>
                <Text style={s.close}>‹</Text>
              </TouchableOpacity>
              <Text style={s.sheetLabel}>{editing ? "EDITAR CLIENTE" : "CLIENTE"}</Text>
              {!editing ? (
                <TouchableOpacity onPress={openEdit}><Text style={s.editBtn}>Editar</Text></TouchableOpacity>
              ) : (
                <View style={{ width: 50 }} />
              )}
            </View>
            {editing ? (
              renderForm()
            ) : selected ? (
              <ScrollView>
                <View style={s.profile}>
                  <View style={s.avatarBig}>
                    <Text style={s.avatarBigText}>{initials(selected.name)}</Text>
                  </View>
                  <Text style={s.profileName}>{selected.name}</Text>
                  <Text style={s.since}>
                    {selected.created_at
                      ? `Cliente desde ${new Date(selected.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}`
                      : "Ficha de relacionamento"}
                  </Text>
                </View>
                <View style={s.actions}>
                  <TouchableOpacity style={s.actionPrimary} onPress={() => selected.phone && Linking.openURL(`tel:${selected.phone}`)}>
                    <Text style={s.actionPrimaryText}>Ligar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.action} onPress={() => selected.phone && Linking.openURL(`sms:${selected.phone}`)}>
                    <Text style={s.actionText}>Mensagem</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.action} onPress={() => selected.email && Linking.openURL(`mailto:${selected.email}`)}>
                    <Text style={s.actionText}>E-mail</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.section}>DADOS</Text>
                <View style={s.info}>
                  <Text style={s.infoLabel}>Telefone</Text>
                  <Text style={s.infoValue}>{selected.phone || "Não informado"}</Text>
                  <View style={s.divider} />
                  <Text style={s.infoLabel}>E-mail</Text>
                  <Text style={s.infoValue}>{selected.email || "Não informado"}</Text>
                  <View style={s.divider} />
                  <Text style={s.infoLabel}>CPF / CNPJ</Text>
                  <Text style={s.infoValue}>{selected.document || "Não informado"}</Text>
                  <View style={s.divider} />
                  <Text style={s.infoLabel}>Endereço</Text>
                  <Text style={s.infoValue}>{selected.address || "Não informado"}</Text>
                  <View style={s.divider} />
                  <Text style={s.infoLabel}>Observações</Text>
                  <Text style={s.infoValue}>{selected.notes || "Nenhuma observação registrada."}</Text>
                </View>
                <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
                  <Text style={s.deleteBtnText}>Excluir cliente</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Create Sheet */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetTop}>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={s.close}>‹</Text>
              </TouchableOpacity>
              <Text style={s.sheetLabel}>NOVO CLIENTE</Text>
              <View style={{ width: 50 }} />
            </View>
            {renderForm()}
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
  search: { marginHorizontal: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: RR.white, borderRadius: 14, borderWidth: 1, borderColor: RR.line, paddingHorizontal: 13 },
  searchIcon: { color: RR.gold, fontSize: 22 },
  input: { flex: 1, color: RR.ink, paddingVertical: 12, fontSize: 14 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, paddingTop: 2, gap: 9, paddingBottom: 80 },
  row: { backgroundColor: RR.white, borderRadius: 15, borderWidth: 1, borderColor: RR.line, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: RR.leaf, alignItems: "center", justifyContent: "center" },
  avatarText: { color: RR.cream, fontFamily: "serif", fontSize: 17, fontStyle: "italic" },
  clientName: { color: RR.forest, fontSize: 15, fontWeight: "700" },
  clientContact: { color: RR.muted, fontSize: 12, marginTop: 3 },
  chevron: { color: RR.gold, fontSize: 25 },
  empty: { padding: 35, alignItems: "center" },
  emptyTitle: { color: RR.forest, fontFamily: "serif", fontSize: 19 },
  emptyText: { color: RR.muted, textAlign: "center", marginTop: 6 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,.35)", justifyContent: "flex-end" },
  sheet: { maxHeight: "92%", minHeight: "72%", backgroundColor: RR.ivory, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingBottom: 24 },
  sheetTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18 },
  close: { color: RR.forest, fontSize: 32 },
  sheetLabel: { color: RR.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.4 },
  editBtn: { color: RR.gold, fontWeight: "700", fontSize: 14 },
  profile: { alignItems: "center", paddingBottom: 16 },
  avatarBig: { width: 70, height: 70, borderRadius: 35, backgroundColor: RR.forest, alignItems: "center", justifyContent: "center" },
  avatarBigText: { color: RR.goldLight, fontFamily: "serif", fontSize: 27, fontStyle: "italic" },
  profileName: { color: RR.forest, fontFamily: "serif", fontSize: 25, marginTop: 10 },
  since: { color: RR.muted, fontSize: 12, marginTop: 3 },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  actionPrimary: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: RR.forest, alignItems: "center" },
  actionPrimaryText: { color: RR.goldLight, fontWeight: "700", fontSize: 12 },
  action: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "rgba(26,46,24,.07)", alignItems: "center" },
  actionText: { color: RR.forest, fontWeight: "700", fontSize: 12 },
  section: { margin: 20, marginBottom: 8, color: RR.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  info: { marginHorizontal: 16, padding: 16, borderRadius: 16, backgroundColor: RR.white, borderWidth: 1, borderColor: RR.line },
  infoLabel: { color: RR.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
  infoValue: { color: RR.forest, fontSize: 14, marginTop: 4, lineHeight: 20 },
  divider: { height: 1, backgroundColor: RR.line, marginVertical: 12 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: RR.forest,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  fabText: { color: RR.goldLight, fontSize: 28, fontWeight: "300", marginTop: -2 },
  fieldLabel: { color: RR.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  fieldInput: {
    backgroundColor: RR.white,
    borderWidth: 1,
    borderColor: RR.line,
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    color: RR.ink,
  },
  tpBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: RR.line,
    alignItems: "center",
    backgroundColor: RR.white,
  },
  tpBtnActive: { backgroundColor: RR.forest, borderColor: RR.forest },
  tpText: { color: RR.body, fontWeight: "600", fontSize: 13 },
  tpTextActive: { color: RR.goldLight },
  saveBtn: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: RR.forest,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: { color: RR.goldLight, fontWeight: "700", fontSize: 15 },
  deleteBtn: {
    alignSelf: "center",
    marginTop: 24,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  deleteBtnText: { color: "#A44A3F", fontWeight: "600", fontSize: 13 },
  more: { color: RR.forest, letterSpacing: 2 },
});
