import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authenticatedFetch } from "../../services/auth";
import { RR } from "../../config/theme";

/* ── types ─────────────────────────────────────────────── */

type TenantConfig = {
  business_name: string;
  owner_name: string;
  profession: string;
  tagline: string;
  timezone: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
};

type BookingSettings = {
  public_page_enabled: boolean;
  auto_approve: boolean;
  max_advance_days: number;
  min_advance_hours: number;
  available_slots: { day_of_week: number; start_time: string; end_time: string }[];
};

/* ── collapsible section ───────────────────────────────── */

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <TouchableOpacity style={s.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={s.sectionChevron}>{open ? "▾" : "›"}</Text>
      </TouchableOpacity>
      {open && <View style={s.sectionBody}>{children}</View>}
    </View>
  );
}

/* ── field helpers ─────────────────────────────────────── */

function Field({ label, value, onChangeText, placeholder, multiline }: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.fieldInput, multiline && { height: 72, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={RR.muted}
        multiline={multiline}
      />
    </View>
  );
}

function NumberField({ label, value, onChangeText }: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.fieldInput, { width: 80 }]}
        value={value}
        onChangeText={(t) => onChangeText(t.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        placeholderTextColor={RR.muted}
      />
    </View>
  );
}

function ToggleRow({ label, value, onValueChange }: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={s.toggleRow}>
      <Text style={s.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: RR.sand, true: RR.leaf }}
        thumbColor={RR.white}
      />
    </View>
  );
}

function SaveButton({ saving, onPress }: { saving: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.saveBtn} onPress={onPress} disabled={saving} activeOpacity={0.7}>
      {saving ? (
        <ActivityIndicator size="small" color={RR.goldLight} />
      ) : (
        <Text style={s.saveBtnText}>Salvar</Text>
      )}
    </TouchableOpacity>
  );
}

/* ── main screen ───────────────────────────────────────── */

export default function ConfiguracoesScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // section visibility
  const [openSection, setOpenSection] = useState<"negocio" | "booking" | "sobre" | null>("negocio");
  function toggle(key: "negocio" | "booking" | "sobre") {
    setOpenSection((prev) => (prev === key ? null : key));
  }

  // tenant config
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [profession, setProfession] = useState("");
  const [tagline, setTagline] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  // booking settings
  const [booking, setBooking] = useState<BookingSettings | null>(null);
  const [publicPage, setPublicPage] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [maxDays, setMaxDays] = useState("");
  const [minHours, setMinHours] = useState("");
  const [savingBooking, setSavingBooking] = useState(false);

  /* ── load data ───────────────────────────────────────── */

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, bookingRes] = await Promise.all([
        authenticatedFetch("/config"),
        authenticatedFetch("/booking/settings"),
      ]);
      if (configRes.status === 401 || bookingRes.status === 401) {
        throw new Error("Entre com Google para acessar as configurações.");
      }
      if (!configRes.ok) throw new Error("Não foi possível carregar dados do negócio.");
      if (!bookingRes.ok) throw new Error("Não foi possível carregar configurações de agendamento.");

      const configData: TenantConfig = await configRes.json();
      const bookingData: BookingSettings = await bookingRes.json();

      setConfig(configData);
      setBusinessName(configData.business_name || "");
      setOwnerName(configData.owner_name || "");
      setProfession(configData.profession || "");
      setTagline(configData.tagline || "");

      setBooking(bookingData);
      setPublicPage(bookingData.public_page_enabled ?? false);
      setAutoApprove(bookingData.auto_approve ?? false);
      setMaxDays(String(bookingData.max_advance_days ?? ""));
      setMinHours(String(bookingData.min_advance_hours ?? ""));

      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── save tenant config ──────────────────────────────── */

  async function saveConfig() {
    setSavingConfig(true);
    try {
      const res = await authenticatedFetch("/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName,
          owner_name: ownerName,
          profession,
          tagline,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível salvar.");
      }
      Alert.alert("Salvo", "Dados do negócio atualizados.");
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Tente novamente.");
    } finally {
      setSavingConfig(false);
    }
  }

  /* ── save booking settings ───────────────────────────── */

  async function saveBooking() {
    setSavingBooking(true);
    try {
      const res = await authenticatedFetch("/booking/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_page_enabled: publicPage,
          auto_approve: autoApprove,
          max_advance_days: Number(maxDays) || 0,
          min_advance_hours: Number(minHours) || 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível salvar.");
      }
      Alert.alert("Salvo", "Configurações de agendamento atualizadas.");
    } catch (e) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Tente novamente.");
    } finally {
      setSavingBooking(false);
    }
  }

  /* ── render ──────────────────────────────────────────── */

  return (
    <SafeAreaView style={s.root} edges={["bottom"]}>
      <View style={s.header}>
        <Text style={s.eyebrow}>SISTEMA</Text>
        <Text style={s.title}>Configurações</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={RR.gold} />
          <Text style={s.muted}>Carregando configurações...</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <View style={s.notice}>
            <Text style={s.noticeTitle}>Acesso necessário</Text>
            <Text style={s.muted}>{error}</Text>
            <TouchableOpacity style={s.retry} onPress={load}>
              <Text style={s.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {/* ── Dados do Negócio ──────────────────────── */}
          <Section title="Dados do Negócio" open={openSection === "negocio"} onToggle={() => toggle("negocio")}>
            <Field label="Nome do negócio" value={businessName} onChangeText={setBusinessName} placeholder="Ex: Raízes e Riquezas" />
            <Field label="Seu nome" value={ownerName} onChangeText={setOwnerName} placeholder="Ex: Fabiana" />
            <Field label="Profissão" value={profession} onChangeText={setProfession} placeholder="Ex: Terapeuta capilar" />
            <Field label="Tagline" value={tagline} onChangeText={setTagline} placeholder="Uma frase curta sobre seu negócio" multiline />
            <SaveButton saving={savingConfig} onPress={saveConfig} />
          </Section>

          {/* ── Agendamento Online ────────────────────── */}
          <Section title="Agendamento Online" open={openSection === "booking"} onToggle={() => toggle("booking")}>
            <ToggleRow label="Página pública ativada" value={publicPage} onValueChange={setPublicPage} />
            <ToggleRow label="Aprovar automaticamente" value={autoApprove} onValueChange={setAutoApprove} />
            <NumberField label="Máximo de dias de antecedência" value={maxDays} onChangeText={setMaxDays} />
            <NumberField label="Mínimo de horas de antecedência" value={minHours} onChangeText={setMinHours} />
            <SaveButton saving={savingBooking} onPress={saveBooking} />
          </Section>

          {/* ── Sobre ─────────────────────────────────── */}
          <Section title="Sobre" open={openSection === "sobre"} onToggle={() => toggle("sobre")}>
            <View style={s.aboutRow}>
              <Text style={s.aboutLabel}>Aplicativo</Text>
              <Text style={s.aboutValue}>Assistente da Fabi</Text>
            </View>
            <View style={s.divider} />
            <View style={s.aboutRow}>
              <Text style={s.aboutLabel}>Versão</Text>
              <Text style={s.aboutValue}>1.0.0</Text>
            </View>
            <View style={s.divider} />
            <TouchableOpacity
              style={s.supportBtn}
              onPress={() => Linking.openURL("mailto:igor.pierine@gmail.com?subject=Suporte%20-%20Assistente%20da%20Fabi")}
              activeOpacity={0.7}
            >
              <Text style={s.supportBtnText}>Falar com suporte</Text>
            </TouchableOpacity>
          </Section>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ── styles ──────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: RR.ivory },
  header: { padding: 20, paddingTop: 18 },
  eyebrow: { color: RR.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  title: { color: RR.forest, fontFamily: "serif", fontSize: 32, marginTop: 2 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  muted: { color: RR.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  notice: {
    backgroundColor: RR.white,
    padding: 24,
    borderRadius: 14,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: RR.line,
    marginHorizontal: 16,
  },
  noticeTitle: { color: RR.forest, fontFamily: "serif", fontSize: 18, fontWeight: "600" },
  retry: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: RR.forest,
    borderRadius: 9,
  },
  retryText: { color: RR.goldLight, fontWeight: "600" },
  list: { padding: 16, gap: 12, paddingBottom: 40 },

  /* section card */
  section: {
    backgroundColor: RR.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: RR.line,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  sectionTitle: { color: RR.forest, fontSize: 16, fontWeight: "700" },
  sectionChevron: { color: RR.gold, fontSize: 20 },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },

  /* field */
  field: { gap: 4 },
  fieldLabel: { color: RR.muted, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  fieldInput: {
    backgroundColor: RR.ivory,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: RR.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: RR.ink,
    fontSize: 14,
  },

  /* toggle */
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  toggleLabel: { color: RR.forest, fontSize: 14, flex: 1 },

  /* save button */
  saveBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 22,
    paddingVertical: 10,
    backgroundColor: RR.forest,
    borderRadius: 10,
    marginTop: 4,
  },
  saveBtnText: { color: RR.goldLight, fontWeight: "700", fontSize: 13 },

  /* about */
  aboutRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  aboutLabel: { color: RR.muted, fontSize: 13 },
  aboutValue: { color: RR.forest, fontSize: 14, fontWeight: "600" },
  divider: { height: 1, backgroundColor: RR.line, marginVertical: 8 },
  supportBtn: {
    marginTop: 6,
    paddingVertical: 12,
    backgroundColor: "rgba(184,135,58,0.12)",
    borderRadius: 10,
    alignItems: "center",
  },
  supportBtnText: { color: RR.gold, fontWeight: "700", fontSize: 13 },
});
