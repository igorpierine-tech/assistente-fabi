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
import { API_URL } from "../../config/env";
import { RR } from "../../config/theme";

/* ── types ───────────────────────────────────────────────── */

type ContractStatus = "draft" | "issued" | "completed" | "voided";

interface Contract {
  id: string;
  contract_number: string;
  service_code: string;
  service_name: string;
  client_name: string | null;
  status: ContractStatus;
  current_revision: number;
  created_at: string;
}

interface ServiceDef {
  code: string;
  name: string;
  family: string;
}

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
}

interface Clausula {
  id: string;
  titulo: string;
  texto: string;
}

interface ContractSnapshot {
  service_code: string;
  service_name: string;
  contract_number: string;
  contratante: {
    nome: string;
    documento: string | null;
    email: string | null;
    telefone: string | null;
    endereco: string | null;
    tipo_pessoa: string | null;
    inscricao_estadual: string | null;
  };
  financeiro: {
    valor_total_centavos: number;
    forma_pagamento: string | null;
    parcelas: number;
    resumo_pagamento: string;
  };
  clausulas_base: Clausula[];
  modulo_especifico: Clausula[];
}

type PaymentMethod =
  | "pix"
  | "dinheiro"
  | "cartao_credito"
  | "cartao_debito"
  | "transferencia"
  | "boleto"
  | "outro";

/* ── constants ───────────────────────────────────────────── */

const STATUS_CONFIG: Record<ContractStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: "Rascunho", bg: "rgba(107,97,82,0.12)", fg: RR.muted },
  issued: { label: "Emitido", bg: "rgba(59,130,246,0.12)", fg: "#2563EB" },
  completed: { label: "Concluido", bg: "rgba(34,197,94,0.12)", fg: "#16A34A" },
  voided: { label: "Cancelado", bg: "rgba(239,68,68,0.12)", fg: "#DC2626" },
};

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartao de credito" },
  { value: "cartao_debito", label: "Cartao de debito" },
  { value: "transferencia", label: "Transferencia" },
  { value: "boleto", label: "Boleto" },
  { value: "outro", label: "Outro" },
];

const TIPO_PESSOA_OPTIONS: { value: string; label: string }[] = [
  { value: "PF", label: "Pessoa Fisica" },
  { value: "PJ", label: "Pessoa Juridica" },
];

/* ── helpers ─────────────────────────────────────────────── */

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

function contractTitle(serviceCode: string): string {
  return serviceCode === "mentoria_adesao"
    ? "CONTRATO AUREA"
    : "CONTRATO DE PRESTACAO DE SERVICOS";
}

/* ── Select picker component ─────────────────────────────── */

function SelectPicker<T extends string>({
  label,
  value,
  options,
  onSelect,
  placeholder,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onSelect: (v: T) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <>
      <Text style={s.fieldLabel}>{label}</Text>
      <TouchableOpacity style={s.selectBtn} onPress={() => setOpen(true)}>
        <Text style={[s.selectBtnText, !selected && { color: RR.muted }]}>
          {selected?.label || placeholder || "Selecionar"}
        </Text>
        <Text style={s.selectChevron}>{">"}</Text>
      </TouchableOpacity>
      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>{label}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.pickerOption, opt.value === value && s.pickerOptionActive]}
                  onPress={() => { onSelect(opt.value); setOpen(false); }}
                >
                  <Text style={[s.pickerOptionText, opt.value === value && s.pickerOptionTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

/* ── main screen ─────────────────────────────────────────── */

export default function ContratosScreen() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [services, setServices] = useState<ServiceDef[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* create modal */
  const [showCreate, setShowCreate] = useState(false);
  const [createService, setCreateService] = useState<string | null>(null);
  const [createClient, setCreateClient] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  /* editor modal */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ContractSnapshot | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [expandedClause, setExpandedClause] = useState<string | null>(null);

  /* ── load contracts ────────────────────────────────────── */

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await authenticatedFetch("/contracts");
      if (!res.ok) throw new Error("Falha ao carregar contratos");
      setContracts(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nao foi possivel carregar.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── load services + clients for create modal ──────────── */

  async function loadCreateData() {
    try {
      const [sRes, cRes] = await Promise.all([
        authenticatedFetch("/contracts/services"),
        authenticatedFetch("/clients"),
      ]);
      if (sRes.ok) setServices(await sRes.json());
      if (cRes.ok) setClients(await cRes.json());
    } catch { /* silent */ }
  }

  /* ── create contract ───────────────────────────────────── */

  async function handleCreate() {
    if (!createService) {
      Alert.alert("Selecione um servico", "Escolha o tipo de servico para o contrato.");
      return;
    }
    setCreating(true);
    try {
      const body: Record<string, string> = { serviceCode: createService };
      if (createClient) body.clientId = createClient;
      const res = await authenticatedFetch("/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao criar contrato");
      }
      setShowCreate(false);
      setCreateService(null);
      setCreateClient(null);
      await load(true);
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  /* ── open editor ───────────────────────────────────────── */

  async function openEditor(contract: Contract) {
    setEditingId(contract.id);
    setEditLoading(true);
    setExpandedClause(null);
    try {
      const res = await authenticatedFetch(`/contracts/${contract.id}`);
      if (!res.ok) throw new Error("Falha ao carregar contrato");
      const data = await res.json();
      setSnapshot(data.snapshot || data);
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Nao foi possivel abrir o contrato.");
      setEditingId(null);
    } finally {
      setEditLoading(false);
    }
  }

  /* ── save snapshot ─────────────────────────────────────── */

  async function saveSnapshot() {
    if (!editingId || !snapshot) return;
    setSaving(true);
    try {
      const res = await authenticatedFetch(`/contracts/${editingId}/snapshot`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contratante: snapshot.contratante,
          financeiro: {
            valor_total_centavos: snapshot.financeiro.valor_total_centavos,
            forma_pagamento: snapshot.financeiro.forma_pagamento,
            parcelas: snapshot.financeiro.parcelas,
          },
          clausulas: [...snapshot.clausulas_base, ...snapshot.modulo_especifico],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao salvar");
      }
      Alert.alert("Salvo", "Rascunho atualizado com sucesso.");
    } catch (e) {
      Alert.alert("Erro ao salvar", e instanceof Error ? e.message : "Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  /* ── issue contract ────────────────────────────────────── */

  async function issueContract() {
    if (!editingId) return;
    Alert.alert(
      "Emitir contrato?",
      "O contrato sera emitido e nao podera mais ser editado. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Emitir",
          onPress: async () => {
            setIssuing(true);
            try {
              const res = await authenticatedFetch(`/contracts/${editingId}/issue`, {
                method: "POST",
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Falha ao emitir");
              }
              Alert.alert("Contrato emitido", "O PDF foi gerado com sucesso.");
              setEditingId(null);
              setSnapshot(null);
              await load(true);
            } catch (e) {
              Alert.alert("Erro", e instanceof Error ? e.message : "Tente novamente.");
            } finally {
              setIssuing(false);
            }
          },
        },
      ]
    );
  }

  /* ── void contract ─────────────────────────────────────── */

  function voidContract(contract: Contract) {
    Alert.alert(
      "Cancelar contrato?",
      `Tem certeza que deseja cancelar o contrato ${contract.contract_number}? Esta acao nao pode ser desfeita.`,
      [
        { text: "Nao", style: "cancel" },
        {
          text: "Cancelar contrato",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await authenticatedFetch(`/contracts/${contract.id}/void`, {
                method: "POST",
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Falha ao cancelar");
              }
              await load(true);
            } catch (e) {
              Alert.alert("Erro", e instanceof Error ? e.message : "Tente novamente.");
            }
          },
        },
      ]
    );
  }

  /* ── download PDF ──────────────────────────────────────── */

  function downloadPdf(contract: Contract) {
    Alert.alert(
      "Contrato PDF",
      "Abrir o PDF no navegador? Voce precisara estar logado la tambem.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Abrir",
          onPress: () => Linking.openURL(`${API_URL}/contracts/${contract.id}/pdf`),
        },
      ]
    );
  }

  /* ── snapshot field updaters ────────────────────────────── */

  function updateContratante<K extends keyof ContractSnapshot["contratante"]>(
    field: K,
    value: ContractSnapshot["contratante"][K]
  ) {
    if (!snapshot) return;
    setSnapshot({
      ...snapshot,
      contratante: { ...snapshot.contratante, [field]: value },
    });
  }

  function updateFinanceiro<K extends keyof ContractSnapshot["financeiro"]>(
    field: K,
    value: ContractSnapshot["financeiro"][K]
  ) {
    if (!snapshot) return;
    setSnapshot({
      ...snapshot,
      financeiro: { ...snapshot.financeiro, [field]: value },
    });
  }

  function updateClause(list: "clausulas_base" | "modulo_especifico", id: string, field: "titulo" | "texto", value: string) {
    if (!snapshot) return;
    setSnapshot({
      ...snapshot,
      [list]: snapshot[list].map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    });
  }

  /* ── editing state helpers ─────────────────────────────── */

  const editingContract = useMemo(
    () => contracts.find((c) => c.id === editingId) || null,
    [contracts, editingId]
  );
  const isDraft = editingContract?.status === "draft";

  /* ── render ────────────────────────────────────────────── */

  return (
    <SafeAreaView style={s.root} edges={["bottom"]}>
      {/* header */}
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>JURIDICO</Text>
          <Text style={s.title}>Contratos</Text>
        </View>
        <View style={s.total}>
          <Text style={s.totalText}>{contracts.length}</Text>
        </View>
      </View>

      {/* list */}
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
              <Text style={s.noticeSub}>{error}</Text>
            </View>
          ) : contracts.length === 0 ? (
            <View style={s.notice}>
              <Text style={s.noticeTitle}>Nenhum contrato</Text>
              <Text style={s.noticeSub}>
                Crie seu primeiro contrato tocando no botao abaixo.
              </Text>
            </View>
          ) : (
            contracts.map((c) => {
              const badge = STATUS_CONFIG[c.status];
              return (
                <TouchableOpacity
                  key={c.id}
                  style={s.card}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (c.status === "draft") openEditor(c);
                  }}
                  onLongPress={() => {
                    const actions: { text: string; onPress?: () => void; style?: "cancel" | "destructive" }[] = [];
                    if (c.status === "draft") {
                      actions.push({ text: "Editar", onPress: () => openEditor(c) });
                    }
                    if (c.status === "issued" || c.status === "completed") {
                      actions.push({ text: "Baixar PDF", onPress: () => downloadPdf(c) });
                    }
                    if (c.status === "draft" || c.status === "issued") {
                      actions.push({ text: "Cancelar contrato", style: "destructive", onPress: () => voidContract(c) });
                    }
                    actions.push({ text: "Fechar", style: "cancel" });
                    Alert.alert(c.contract_number, contractTitle(c.service_code), actions);
                  }}
                >
                  <View style={s.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.contractNumber}>{c.contract_number}</Text>
                      <Text style={s.serviceName}>{c.service_name}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[s.badgeText, { color: badge.fg }]}>{badge.label}</Text>
                    </View>
                  </View>
                  <View style={s.cardBottom}>
                    <Text style={s.clientLabel}>{c.client_name || "Sem cliente"}</Text>
                    <Text style={s.dateLabel}>{formatDate(c.created_at)}</Text>
                  </View>
                  {(c.status === "issued" || c.status === "completed") && (
                    <TouchableOpacity style={s.pdfBtn} onPress={() => downloadPdf(c)}>
                      <Text style={s.pdfBtnText}>Baixar PDF</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        activeOpacity={0.85}
        onPress={() => {
          loadCreateData();
          setShowCreate(true);
        }}
      >
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      {/* ── create modal ────────────────────────────────── */}
      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetTop}>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={s.closeBtn}>{"<"}</Text>
              </TouchableOpacity>
              <Text style={s.sheetLabel}>NOVO CONTRATO</Text>
              <View style={{ width: 28 }} />
            </View>
            <ScrollView contentContainerStyle={s.sheetBody}>
              <SelectPicker
                label="Servico"
                value={createService}
                options={services.map((sv) => ({ value: sv.code, label: sv.name }))}
                onSelect={setCreateService}
                placeholder="Selecione o servico"
              />
              <View style={{ height: 16 }} />
              <SelectPicker
                label="Cliente (opcional)"
                value={createClient}
                options={clients.map((cl) => ({ value: cl.id, label: cl.name }))}
                onSelect={setCreateClient}
                placeholder="Selecione o cliente"
              />
              <TouchableOpacity
                style={[s.primaryBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={RR.goldLight} />
                ) : (
                  <Text style={s.primaryBtnText}>Criar contrato</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── editor modal ────────────────────────────────── */}
      <Modal
        visible={!!editingId}
        animationType="slide"
        transparent
        onRequestClose={() => { setEditingId(null); setSnapshot(null); }}
      >
        <View style={s.overlay}>
          <KeyboardAvoidingView
            style={s.sheet}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={s.sheetTop}>
              <TouchableOpacity onPress={() => { setEditingId(null); setSnapshot(null); }}>
                <Text style={s.closeBtn}>{"<"}</Text>
              </TouchableOpacity>
              <Text style={s.sheetLabel}>
                {editingContract ? contractTitle(editingContract.service_code) : "CONTRATO"}
              </Text>
              <View style={{ width: 28 }} />
            </View>

            {editLoading ? (
              <View style={s.center}>
                <ActivityIndicator color={RR.gold} />
              </View>
            ) : snapshot ? (
              <ScrollView contentContainerStyle={s.sheetBody}>
                {/* contract header info */}
                <View style={s.editorInfo}>
                  <Text style={s.editorNumber}>{snapshot.contract_number}</Text>
                  <Text style={s.editorService}>{snapshot.service_name}</Text>
                  {editingContract && (
                    <View style={[s.badge, { backgroundColor: STATUS_CONFIG[editingContract.status].bg, alignSelf: "flex-start", marginTop: 6 }]}>
                      <Text style={[s.badgeText, { color: STATUS_CONFIG[editingContract.status].fg }]}>
                        {STATUS_CONFIG[editingContract.status].label}
                      </Text>
                    </View>
                  )}
                </View>

                {/* ── contratante ─────────────────────────── */}
                <Text style={s.section}>CONTRATANTE</Text>
                <View style={s.fieldGroup}>
                  <Text style={s.fieldLabel}>Nome</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={snapshot.contratante.nome}
                    onChangeText={(v) => updateContratante("nome", v)}
                    editable={isDraft}
                    placeholder="Nome completo"
                    placeholderTextColor={RR.muted}
                  />

                  <SelectPicker
                    label="Tipo de pessoa"
                    value={snapshot.contratante.tipo_pessoa as string | null}
                    options={TIPO_PESSOA_OPTIONS}
                    onSelect={(v) => updateContratante("tipo_pessoa", v)}
                    placeholder="PF ou PJ"
                  />

                  <Text style={s.fieldLabel}>CPF / CNPJ</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={snapshot.contratante.documento || ""}
                    onChangeText={(v) => updateContratante("documento", v)}
                    editable={isDraft}
                    placeholder="Documento"
                    placeholderTextColor={RR.muted}
                  />

                  <Text style={s.fieldLabel}>E-mail</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={snapshot.contratante.email || ""}
                    onChangeText={(v) => updateContratante("email", v)}
                    editable={isDraft}
                    placeholder="email@exemplo.com"
                    placeholderTextColor={RR.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Text style={s.fieldLabel}>Telefone</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={snapshot.contratante.telefone || ""}
                    onChangeText={(v) => updateContratante("telefone", v)}
                    editable={isDraft}
                    placeholder="(00) 00000-0000"
                    placeholderTextColor={RR.muted}
                    keyboardType="phone-pad"
                  />

                  <Text style={s.fieldLabel}>Endereco</Text>
                  <TextInput
                    style={[s.fieldInput, { minHeight: 56 }]}
                    value={snapshot.contratante.endereco || ""}
                    onChangeText={(v) => updateContratante("endereco", v)}
                    editable={isDraft}
                    placeholder="Endereco completo"
                    placeholderTextColor={RR.muted}
                    multiline
                  />
                </View>

                {/* ── financeiro ──────────────────────────── */}
                <Text style={s.section}>FINANCEIRO</Text>
                <View style={s.fieldGroup}>
                  <Text style={s.fieldLabel}>Valor total (R$)</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={
                      snapshot.financeiro.valor_total_centavos > 0
                        ? (snapshot.financeiro.valor_total_centavos / 100).toFixed(2)
                        : ""
                    }
                    onChangeText={(v) => {
                      const cleaned = v.replace(/[^0-9.,]/g, "").replace(",", ".");
                      const cents = Math.round(parseFloat(cleaned || "0") * 100);
                      updateFinanceiro("valor_total_centavos", isNaN(cents) ? 0 : cents);
                    }}
                    editable={isDraft}
                    placeholder="0,00"
                    placeholderTextColor={RR.muted}
                    keyboardType="decimal-pad"
                  />

                  <SelectPicker
                    label="Forma de pagamento"
                    value={snapshot.financeiro.forma_pagamento as PaymentMethod | null}
                    options={METHOD_OPTIONS}
                    onSelect={(v) => updateFinanceiro("forma_pagamento", v)}
                    placeholder="Selecione"
                  />

                  <Text style={s.fieldLabel}>Parcelas</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={snapshot.financeiro.parcelas > 0 ? String(snapshot.financeiro.parcelas) : ""}
                    onChangeText={(v) => {
                      const n = parseInt(v.replace(/\D/g, ""), 10);
                      updateFinanceiro("parcelas", isNaN(n) ? 1 : Math.max(1, n));
                    }}
                    editable={isDraft}
                    placeholder="1"
                    placeholderTextColor={RR.muted}
                    keyboardType="number-pad"
                  />

                  {snapshot.financeiro.valor_total_centavos > 0 && (
                    <Text style={s.paymentSummary}>
                      {formatBRL(snapshot.financeiro.valor_total_centavos)}
                      {snapshot.financeiro.parcelas > 1
                        ? ` em ${snapshot.financeiro.parcelas}x de ${formatBRL(Math.round(snapshot.financeiro.valor_total_centavos / snapshot.financeiro.parcelas))}`
                        : " a vista"}
                    </Text>
                  )}
                </View>

                {/* ── clausulas ───────────────────────────── */}
                {snapshot.clausulas_base.length > 0 && (
                  <>
                    <Text style={s.section}>CLAUSULAS BASE</Text>
                    {snapshot.clausulas_base.map((cl) => (
                      <View key={cl.id} style={s.clauseCard}>
                        <TouchableOpacity
                          style={s.clauseHeader}
                          onPress={() => setExpandedClause(expandedClause === cl.id ? null : cl.id)}
                        >
                          <Text style={s.clauseTitle} numberOfLines={expandedClause === cl.id ? undefined : 1}>
                            {cl.titulo}
                          </Text>
                          <Text style={s.clauseChevron}>
                            {expandedClause === cl.id ? "v" : ">"}
                          </Text>
                        </TouchableOpacity>
                        {expandedClause === cl.id && (
                          <View style={s.clauseBody}>
                            {isDraft ? (
                              <>
                                <TextInput
                                  style={s.clauseTitleInput}
                                  value={cl.titulo}
                                  onChangeText={(v) => updateClause("clausulas_base", cl.id, "titulo", v)}
                                  placeholder="Titulo"
                                  placeholderTextColor={RR.muted}
                                />
                                <TextInput
                                  style={s.clauseTextInput}
                                  value={cl.texto}
                                  onChangeText={(v) => updateClause("clausulas_base", cl.id, "texto", v)}
                                  multiline
                                  placeholder="Texto da clausula"
                                  placeholderTextColor={RR.muted}
                                />
                              </>
                            ) : (
                              <Text style={s.clauseText}>{cl.texto}</Text>
                            )}
                          </View>
                        )}
                      </View>
                    ))}
                  </>
                )}

                {snapshot.modulo_especifico.length > 0 && (
                  <>
                    <Text style={s.section}>CLAUSULAS ESPECIFICAS</Text>
                    {snapshot.modulo_especifico.map((cl) => (
                      <View key={cl.id} style={s.clauseCard}>
                        <TouchableOpacity
                          style={s.clauseHeader}
                          onPress={() => setExpandedClause(expandedClause === cl.id ? null : cl.id)}
                        >
                          <Text style={s.clauseTitle} numberOfLines={expandedClause === cl.id ? undefined : 1}>
                            {cl.titulo}
                          </Text>
                          <Text style={s.clauseChevron}>
                            {expandedClause === cl.id ? "v" : ">"}
                          </Text>
                        </TouchableOpacity>
                        {expandedClause === cl.id && (
                          <View style={s.clauseBody}>
                            {isDraft ? (
                              <>
                                <TextInput
                                  style={s.clauseTitleInput}
                                  value={cl.titulo}
                                  onChangeText={(v) => updateClause("modulo_especifico", cl.id, "titulo", v)}
                                  placeholder="Titulo"
                                  placeholderTextColor={RR.muted}
                                />
                                <TextInput
                                  style={s.clauseTextInput}
                                  value={cl.texto}
                                  onChangeText={(v) => updateClause("modulo_especifico", cl.id, "texto", v)}
                                  multiline
                                  placeholder="Texto da clausula"
                                  placeholderTextColor={RR.muted}
                                />
                              </>
                            ) : (
                              <Text style={s.clauseText}>{cl.texto}</Text>
                            )}
                          </View>
                        )}
                      </View>
                    ))}
                  </>
                )}

                {/* ── action buttons ─────────────────────── */}
                {isDraft && (
                  <View style={s.editorActions}>
                    <TouchableOpacity
                      style={[s.saveBtn, saving && { opacity: 0.6 }]}
                      onPress={saveSnapshot}
                      disabled={saving || issuing}
                    >
                      {saving ? (
                        <ActivityIndicator color={RR.goldLight} />
                      ) : (
                        <Text style={s.saveBtnText}>Salvar rascunho</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.issueBtn, issuing && { opacity: 0.6 }]}
                      onPress={issueContract}
                      disabled={saving || issuing}
                    >
                      {issuing ? (
                        <ActivityIndicator color={RR.white} />
                      ) : (
                        <Text style={s.issueBtnText}>Emitir contrato</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {editingContract && (editingContract.status === "issued" || editingContract.status === "completed") && (
                  <TouchableOpacity style={s.pdfBtnLarge} onPress={() => downloadPdf(editingContract)}>
                    <Text style={s.pdfBtnLargeText}>Baixar PDF</Text>
                  </TouchableOpacity>
                )}

                <View style={{ height: 40 }} />
              </ScrollView>
            ) : null}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── styles ──────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: RR.ivory },

  /* header */
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

  /* loading & empty */
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 12, paddingBottom: 100 },
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
  noticeSub: { color: RR.muted, textAlign: "center", lineHeight: 20, fontSize: 14 },

  /* card */
  card: {
    backgroundColor: RR.white,
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: RR.line,
    gap: 6,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  contractNumber: { color: RR.forest, fontSize: 16, fontWeight: "700" },
  serviceName: { color: RR.body, fontSize: 13, marginTop: 2 },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  clientLabel: { color: RR.muted, fontSize: 13 },
  dateLabel: { color: RR.muted, fontSize: 12 },

  /* badge */
  badge: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },

  /* pdf button on card */
  pdfBtn: {
    marginTop: 6,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: RR.gold,
    alignItems: "center",
  },
  pdfBtnText: { color: RR.forest, fontSize: 13, fontWeight: "600" },

  /* FAB */
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
    shadowOpacity: 0.22,
    shadowRadius: 6,
  },
  fabText: { color: RR.goldLight, fontSize: 30, lineHeight: 33, fontWeight: "300" },

  /* modal overlay & sheet */
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,.35)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "93%",
    minHeight: "72%",
    backgroundColor: RR.ivory,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingBottom: 24,
  },
  sheetTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
  },
  closeBtn: { color: RR.forest, fontSize: 28, fontWeight: "600" },
  sheetLabel: { color: RR.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.4 },
  sheetBody: { paddingHorizontal: 20, paddingBottom: 32 },

  /* select picker */
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: RR.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RR.line,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: 6,
  },
  selectBtnText: { color: RR.ink, fontSize: 14, flex: 1 },
  selectChevron: { color: RR.muted, fontSize: 14 },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  pickerSheet: {
    width: "100%",
    backgroundColor: RR.ivory,
    borderRadius: 18,
    padding: 20,
  },
  pickerTitle: {
    color: RR.forest,
    fontFamily: "serif",
    fontSize: 18,
    marginBottom: 14,
    textAlign: "center",
  },
  pickerOption: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  pickerOptionActive: { backgroundColor: "rgba(26,46,24,0.08)" },
  pickerOptionText: { color: RR.body, fontSize: 15 },
  pickerOptionTextActive: { color: RR.forest, fontWeight: "700" },

  /* create modal button */
  primaryBtn: {
    marginTop: 28,
    paddingVertical: 15,
    borderRadius: 13,
    backgroundColor: RR.forest,
    alignItems: "center",
  },
  primaryBtnText: { color: RR.goldLight, fontWeight: "700", fontSize: 15 },

  /* editor info */
  editorInfo: {
    backgroundColor: RR.white,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: RR.line,
    marginBottom: 4,
  },
  editorNumber: { color: RR.forest, fontFamily: "serif", fontSize: 22, fontWeight: "700" },
  editorService: { color: RR.gold, fontSize: 13, fontWeight: "600", marginTop: 3 },

  /* sections */
  section: {
    marginTop: 22,
    marginBottom: 8,
    color: RR.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
  },

  /* field group */
  fieldGroup: {
    backgroundColor: RR.white,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: RR.line,
    gap: 4,
  },
  fieldLabel: {
    color: RR.muted,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 10,
  },
  fieldInput: {
    backgroundColor: RR.ivory,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: RR.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: RR.ink,
    fontSize: 14,
    marginTop: 4,
  },
  paymentSummary: {
    color: RR.gold,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 10,
    textAlign: "center",
  },

  /* clauses */
  clauseCard: {
    backgroundColor: RR.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: RR.line,
    marginBottom: 8,
    overflow: "hidden",
  },
  clauseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  clauseTitle: { color: RR.forest, fontSize: 14, fontWeight: "600", flex: 1, marginRight: 8 },
  clauseChevron: { color: RR.muted, fontSize: 14 },
  clauseBody: { paddingHorizontal: 14, paddingBottom: 14 },
  clauseText: { color: RR.body, fontSize: 13, lineHeight: 20 },
  clauseTitleInput: {
    backgroundColor: RR.ivory,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: RR.line,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: RR.forest,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  clauseTextInput: {
    backgroundColor: RR.ivory,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: RR.line,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: RR.body,
    fontSize: 13,
    lineHeight: 20,
    minHeight: 80,
    textAlignVertical: "top",
  },

  /* editor actions */
  editorActions: {
    marginTop: 24,
    gap: 10,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: RR.gold,
    alignItems: "center",
  },
  saveBtnText: { color: RR.forest, fontWeight: "700", fontSize: 15 },
  issueBtn: {
    paddingVertical: 14,
    borderRadius: 13,
    backgroundColor: RR.forest,
    alignItems: "center",
  },
  issueBtnText: { color: RR.goldLight, fontWeight: "700", fontSize: 15 },

  /* pdf large button in editor */
  pdfBtnLarge: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: RR.gold,
    backgroundColor: "rgba(107,143,94,0.10)",
    alignItems: "center",
  },
  pdfBtnLargeText: { color: RR.forest, fontWeight: "700", fontSize: 15 },
});
