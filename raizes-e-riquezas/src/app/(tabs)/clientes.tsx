import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Modal,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet, apiPost, apiPut, apiDelete } from "../../lib/api";

const C = {
  primary: "#1a2e18", primaryLight: "#2f4a2b", secondary: "#b8873a",
  gold: "#d9b268", goldLight: "#e8c880", bg: "#f4ede0", surface: "#fdfaf3",
  white: "#fff", text: "#1a2e18", textLight: "#f4ede0", textMuted: "#6b6152",
  textWarm: "#8a7f6a", border: "rgba(26,46,24,0.08)", error: "#e05a2b",
};

interface Client { id: string; name: string; phone: string | null; email: string | null; notes: string | null; }
interface ClientForm { name: string; phone: string; email: string; notes: string; }

const emptyForm: ClientForm = { name: "", phone: "", email: "", notes: "" };

const DEMO_CLIENTS: Client[] = [
  { id: "d1", name: "Maria Valentina", phone: "(65) 99123-4567", email: "maria@email.com", notes: "Constelação familiar" },
  { id: "d2", name: "Ana Paula", phone: "(65) 99234-5678", email: "ana.paula@email.com", notes: "Consultoria financeira" },
  { id: "d3", name: "Juliana Costa", phone: "(65) 99345-6789", email: "juliana@email.com", notes: null },
  { id: "d4", name: "Fernanda Lima", phone: "(65) 99456-7890", email: "fernanda@email.com", notes: "Constelação - 3 sessões realizadas" },
  { id: "d5", name: "Roberto Silva", phone: "(65) 99567-8901", email: "roberto@email.com", notes: "Consultoria financeira mensal" },
];

function getInitials(name: string) {
  const parts = name.split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export default function ClientesScreen() {
  const [clients, setClients] = useState<Client[]>(DEMO_CLIENTS);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [isDemo, setIsDemo] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await AsyncStorage.getItem("fabi_session");
      if (session) setIsDemo(false);
    })();
  }, []);

  const fetchClients = useCallback(async () => {
    if (isDemo) return;
    setLoading(true);
    try {
      const res = await apiGet("/clients");
      if (res.ok) setClients(await res.json());
    } catch {}
    setLoading(false);
  }, [isDemo]);

  useEffect(() => { if (!isDemo) fetchClients(); }, [isDemo, fetchClients]);

  const filtered = search
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search)
      )
    : clients;

  function openNew() { setEditingClient(null); setForm(emptyForm); setShowModal(true); }
  function openEdit(client: Client) {
    setEditingClient(client);
    setForm({ name: client.name, phone: client.phone || "", email: client.email || "", notes: client.notes || "" });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (isDemo) {
      if (editingClient) {
        setClients((prev) => prev.map((c) => c.id === editingClient.id ? { ...c, name: form.name, phone: form.phone || null, email: form.email || null, notes: form.notes || null } : c));
      } else {
        setClients((prev) => [...prev, { id: `d${Date.now()}`, name: form.name, phone: form.phone || null, email: form.email || null, notes: form.notes || null }]);
      }
      setShowModal(false); setSaving(false); return;
    }
    try {
      const body = { name: form.name, phone: form.phone || undefined, email: form.email || undefined, notes: form.notes || undefined };
      if (editingClient) {
        const res = await apiPut(`/clients/${editingClient.id}`, body);
        if (res.ok) { const updated = await res.json(); setClients((prev) => prev.map((c) => c.id === editingClient.id ? updated : c)); }
      } else {
        const res = await apiPost("/clients", body);
        if (res.ok) { const created = await res.json(); setClients((prev) => [...prev, created]); }
      }
    } catch { Alert.alert("Erro", "Não foi possível salvar o cliente."); }
    setShowModal(false); setSaving(false);
  }

  function handleDelete(client: Client) {
    Alert.alert("Excluir cliente", `Deseja excluir "${client.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => {
        if (isDemo) { setClients((prev) => prev.filter((c) => c.id !== client.id)); return; }
        try { const res = await apiDelete(`/clients/${client.id}`); if (res.ok) setClients((prev) => prev.filter((c) => c.id !== client.id)); }
        catch { Alert.alert("Erro", "Não foi possível excluir o cliente."); }
      }},
    ]);
  }

  return (
    <SafeAreaView style={s.container} edges={["bottom"]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerLabel}>CLIENTES</Text>
          <Text style={s.headerTitle}>{clients.length} <Text style={{ color: C.secondary, fontStyle: "italic" }}>cadastrados</Text></Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={openNew}>
          <Text style={s.addBtnIcon}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchBox}
          placeholder="Buscar cliente, evento..."
          placeholderTextColor={C.textWarm}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading && <View style={s.loadingBar}><ActivityIndicator size="small" color={C.secondary} /></View>}

      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>👤</Text>
          <Text style={s.emptyText}>{search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} onPress={() => openEdit(item)} activeOpacity={0.7}>
              <View style={s.cardHeader}>
                <LinearGradient colors={["#2f4a2b", "#b8873a"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarCircle}>
                  <Text style={s.avatarText}>{getInitials(item.name)}</Text>
                </LinearGradient>
                <View style={s.cardInfo}>
                  <Text style={s.cardName}>{item.name}</Text>
                  {item.phone && <Text style={s.cardMeta}>{item.phone}</Text>}
                  {item.email && <Text style={s.cardMeta}>{item.email}</Text>}
                  {item.notes && (
                    <View style={s.tagRow}>
                      <View style={s.tag}><Text style={s.tagText}>{item.notes}</Text></View>
                    </View>
                  )}
                </View>
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(item)}>
                  <Text style={s.actionBtnText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtnDanger} onPress={() => handleDelete(item)}>
                  <Text style={s.actionBtnDangerText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>{editingClient ? "Editar" : "Quem estamos"}</Text>
                <Text style={s.modalTitleGold}>{editingClient ? "cliente" : "recebendo?"}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.modalSubtitle}>Só o essencial — o resto o assistente ajuda depois.</Text>

            <ScrollView style={s.form} contentContainerStyle={{ gap: 14 }}>
              <View style={s.fieldGroup}>
                <Text style={s.label}>NOME</Text>
                <TextInput style={s.input} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Nome completo" placeholderTextColor={C.textWarm} autoFocus />
              </View>
              <View style={s.fieldGroup}>
                <Text style={s.label}>TELEFONE</Text>
                <TextInput style={s.input} value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} placeholder="(65) 99999-9999" placeholderTextColor={C.textWarm} keyboardType="phone-pad" />
              </View>
              <View style={s.fieldGroup}>
                <Text style={s.label}>E-MAIL (OPCIONAL)</Text>
                <TextInput style={s.input} value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} placeholder="cliente@email.com" placeholderTextColor={C.textWarm} keyboardType="email-address" autoCapitalize="none" />
              </View>
              <View style={s.fieldGroup}>
                <Text style={s.label}>OBSERVAÇÕES</Text>
                <TextInput style={[s.input, s.textArea]} value={form.notes} onChangeText={(t) => setForm({ ...form, notes: t })} placeholder="Anotações sobre o cliente..." placeholderTextColor={C.textWarm} multiline numberOfLines={3} />
              </View>
            </ScrollView>

            <View style={s.formActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, (!form.name.trim() || saving) && { opacity: 0.5 }]} onPress={handleSave} disabled={!form.name.trim() || saving}>
                <Text style={s.saveBtnText}>{saving ? "Salvando..." : "Salvar"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 20, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  headerLabel: { fontSize: 11, letterSpacing: 1, color: C.textMuted, fontWeight: "600" },
  headerTitle: { fontFamily: "serif", fontSize: 28, color: C.primary, lineHeight: 32, marginTop: 4 },
  addBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.primary, justifyContent: "center", alignItems: "center" },
  addBtnIcon: { fontSize: 20, color: C.gold, fontWeight: "300" },

  searchWrap: { padding: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  searchBox: { backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.border },

  loadingBar: { padding: 8, alignItems: "center" },

  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: C.textMuted },

  card: { backgroundColor: C.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  cardHeader: { flexDirection: "row", gap: 12, marginBottom: 10 },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  avatarText: { fontFamily: "serif", fontSize: 18, fontStyle: "italic", color: C.textLight },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { fontFamily: "serif", fontSize: 17, color: C.primary },
  cardMeta: { fontSize: 12, color: C.textMuted },
  tagRow: { flexDirection: "row", marginTop: 4 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "rgba(184,135,58,0.15)", borderRadius: 4 },
  tagText: { fontSize: 10, fontWeight: "600", color: "#8a6420", letterSpacing: 0.4 },
  cardActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: "rgba(26,46,24,0.06)" },
  actionBtnText: { fontSize: 12, fontWeight: "500", color: C.primary },
  actionBtnDanger: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: "rgba(224,90,43,0.08)" },
  actionBtnDangerText: { fontSize: 12, fontWeight: "500", color: C.error },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "85%", paddingBottom: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingBottom: 0 },
  modalTitle: { fontFamily: "serif", fontSize: 28, color: C.primary, lineHeight: 30 },
  modalTitleGold: { fontFamily: "serif", fontSize: 28, color: C.secondary, fontStyle: "italic", lineHeight: 30 },
  modalClose: { fontSize: 20, color: C.textMuted, padding: 4 },
  modalSubtitle: { fontSize: 13.5, color: C.textMuted, paddingHorizontal: 20, marginTop: 8, lineHeight: 20 },

  form: { padding: 20 },
  fieldGroup: {},
  label: { fontSize: 10, fontWeight: "600", color: C.textMuted, letterSpacing: 0.8, marginBottom: 6 },
  input: { backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border },
  textArea: { minHeight: 80, textAlignVertical: "top" },

  formActions: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontWeight: "500", color: C.textMuted },
  saveBtn: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: C.primary, alignItems: "center" },
  saveBtnText: { fontSize: 14, fontWeight: "500", color: C.gold },
});
