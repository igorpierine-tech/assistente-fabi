import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, Modal,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import { authenticatedFetch, hasSession } from "../../services/auth";

const C = {
  primary: "#5E4B37", primaryLight: "#8B7355", secondary: "#C4A265", secondaryLight: "#E8D4A0",
  accent: "#6B8F5E", bg: "#FBF8F3", surface: "#FFFFFF", text: "#2C2418",
  textLight: "#F5F0E8", textMuted: "#8B8078", border: "#E8E0D4", error: "#C75050",
};

const TYPE_COLORS: Record<string, string> = {
  constelacao: "#8B5E3C", consultoria: "#C8A951", planejamento: "#6B8F5E", reuniao: "#5E7E8B",
};

interface Message { id: string; role: "user" | "assistant"; content: string; timestamp: Date }

interface DayEvent {
  id: string; title: string; type: string; startH: number; startM: number; durMin: number;
  clientName?: string; clientPhone?: string; clientEmail?: string;
  earlyWins: string[];
}

const DEMO_EVENTS: DayEvent[] = [];

const STATUS_COLORS: Record<string, string> = {
  previsto: "#FFA726", confirmado: "#66BB6A", em_andamento: "#42A5F5", concluido: "#78909C", cancelado: "#EF5350",
};

function getDemoResponse(_input: string): string {
  return "Para usar a assistente, faça login com sua conta Google. Assim terei acesso à sua agenda e dados reais.";
}

function pad(n: number) { return n.toString().padStart(2, "0"); }
function fmtTime(h: number, m: number) { return `${pad(h)}:${pad(m)}`; }
function endTime(h: number, m: number, dur: number) {
  const totalM = h * 60 + m + dur;
  return fmtTime(Math.floor(totalM / 60), totalM % 60);
}

export default function AssistenteScreen() {
  const [tab, setTab] = useState<"dia" | "chat">("chat");
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: "Olá, Fabi! Sou sua assistente de agenda. Toque no microfone para falar ou digite sua mensagem.", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<DayEvent | null>(null);
  const [prontuarioTab, setProntuarioTab] = useState<"dados" | "prontuario" | "historico">("dados");
  const [eventStatus, setEventStatus] = useState("previsto");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => { hasSession().then(setIsAuthenticated); }, []);

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    if (!isAuthenticated) {
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: getDemoResponse(text), timestamp: new Date() }]);
      setIsLoading(false);
      return;
    }
    try {
      const response = await authenticatedFetch("/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível processar a mensagem.");
      if (data.conversationId) setConversationId(data.conversationId);
      setMessages((prev) => [...prev, { id: `${Date.now()}-assistant`, role: "assistant", content: data.message, timestamp: new Date() }]);
    } catch (e) {
      setMessages((prev) => [...prev, { id: `${Date.now()}-error`, role: "assistant", content: e instanceof Error ? e.message : "Tive um problema ao processar sua mensagem. Tente novamente.", timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function sendVoice(uri: string) {
    if (!isAuthenticated) {
      sendMessage("Qual a minha agenda para hoje?");
      return;
    }
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("audio", { uri, name: "audio.m4a", type: "audio/m4a" } as unknown as Blob);
      if (conversationId) formData.append("conversationId", conversationId);
      const response = await authenticatedFetch("/chat/voice", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Erro ao transcrever áudio.");
      if (data.conversationId) setConversationId(data.conversationId);
      if (data.transcription) {
        setMessages((prev) => [...prev, { id: `${Date.now()}-user`, role: "user", content: data.transcription, timestamp: new Date() }]);
      }
      setMessages((prev) => [...prev, { id: `${Date.now()}-assistant`, role: "assistant", content: data.message, timestamp: new Date() }]);
    } catch (e) {
      setMessages((prev) => [...prev, { id: `${Date.now()}-error`, role: "assistant", content: e instanceof Error ? e.message : "Erro ao processar áudio.", timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleRecording() {
    if (isRecording) {
      setIsRecording(false);
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();
          setRecording(null);
          if (uri) {
            await sendVoice(uri);
            return;
          }
        } catch {
          setRecording(null);
        }
      }
      return;
    }
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  }

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <SafeAreaView style={[s.container, tab === "chat" && s.containerDark]} edges={["top", "bottom"]}>
      {tab === "chat" && <View style={s.aiHeader}><View style={s.online} /><View style={{ flex: 1 }}><Text style={s.aiHeaderTitle}>Assistente Raízes</Text><Text style={s.aiHeaderSub}>Sempre disponível · lê sua agenda</Text></View><Text style={s.aiHeaderMore}>•••</Text></View>}
      {/* Sub-tabs */}
      <View style={s.subTabs}>
        <TouchableOpacity style={[s.subTab, tab === "dia" && s.subTabActive]} onPress={() => setTab("dia")}>
          <Text style={[s.subTabText, tab === "dia" && s.subTabTextActive]}>Resumo do Dia</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.subTab, tab === "chat" && s.subTabActive]} onPress={() => setTab("chat")}>
          <Text style={[s.subTabText, tab === "chat" && s.subTabTextActive]}>Chat</Text>
        </TouchableOpacity>
      </View>

      {tab === "dia" ? (
        <ScrollView style={s.dayContainer} contentContainerStyle={{ paddingBottom: 24 }}>
          <Text style={s.dayTitle}>Hoje</Text>
          <Text style={s.dayDate}>{today}</Text>

          {!isAuthenticated ? (
            <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
              <Text style={{ fontSize: 16, color: C.textMuted, textAlign: "center", lineHeight: 24 }}>
                Faça login com sua conta Google para ver seus compromissos do dia.
              </Text>
            </View>
          ) : DEMO_EVENTS.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
              <Text style={{ fontSize: 16, color: C.textMuted, textAlign: "center", lineHeight: 24 }}>
                Nenhum compromisso para hoje. Use o chat para agendar!
              </Text>
            </View>
          ) : (
            DEMO_EVENTS.map((ev) => (
              <TouchableOpacity
                key={ev.id}
                style={[s.eventCard, { borderLeftColor: TYPE_COLORS[ev.type] || C.secondary }]}
                onPress={() => { setSelectedEvent(ev); setProntuarioTab("dados"); setEventStatus("previsto"); }}
                activeOpacity={0.7}
              >
                <View style={s.eventRow}>
                  <Text style={s.eventTime}>{fmtTime(ev.startH, ev.startM)}</Text>
                  <View style={s.eventInfo}>
                    <Text style={s.eventTitle} numberOfLines={1}>{ev.title}</Text>
                    <Text style={s.eventDur}>{fmtTime(ev.startH, ev.startM)} — {endTime(ev.startH, ev.startM, ev.durMin)}</Text>
                  </View>
                </View>
                <View style={s.winsContainer}>
                  {ev.earlyWins.map((w, i) => (
                    <View key={i} style={s.winRow}>
                      <View style={s.winDot} />
                      <Text style={s.winText}>{w}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : (
        <>
          {!isAuthenticated && <View style={s.demoBanner}>
            <Text style={s.demoText}>Modo demonstração — entre com Google para usar seus dados reais</Text>
          </View>}

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={[s.msgRow, item.role === "user" ? s.msgRowUser : s.msgRowAssistant]}>
                {item.role === "assistant" && (
                  <Image source={require("../../assets/icon.png")} style={s.avatar} resizeMode="contain" />
                )}
                <View style={[s.bubble, item.role === "user" ? s.bubbleUser : s.bubbleAssistant]}>
                  <Text style={[s.msgText, item.role === "user" && s.msgTextUser]}>{item.content}</Text>
                  <Text style={[s.msgTime, item.role === "user" && s.msgTimeUser]}>
                    {item.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            )}
            contentContainerStyle={s.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          {isLoading && (
            <View style={s.loadingBar}>
              <ActivityIndicator size="small" color={C.secondary} />
              <Text style={s.loadingText}>Processando...</Text>
            </View>
          )}

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={s.inputArea}>
              <TouchableOpacity style={[s.micBtn, isRecording && s.micBtnRec]} onPress={toggleRecording} disabled={isLoading}>
                <Text style={s.micIcon}>{isRecording ? "⏹" : "🎤"}</Text>
              </TouchableOpacity>
              <TextInput
                style={s.input} value={input} onChangeText={setInput}
                placeholder="Digite sua mensagem..." placeholderTextColor={C.textMuted}
                editable={!isLoading && !isRecording} onSubmitEditing={() => sendMessage(input)} returnKeyType="send"
              />
              <TouchableOpacity
                style={[s.sendBtn, (!input.trim() || isLoading) && s.sendBtnOff]}
                onPress={() => sendMessage(input)} disabled={!input.trim() || isLoading}
              >
                <Text style={s.sendIcon}>➤</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </>
      )}

      {/* Modal Prontuário */}
      <Modal visible={!!selectedEvent} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Detalhes do Agendamento</Text>
              <TouchableOpacity onPress={() => setSelectedEvent(null)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Status bar */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statusBar}>
              {Object.entries(STATUS_COLORS).map(([key, color]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.statusBtn, eventStatus === key && { backgroundColor: color }]}
                  onPress={() => setEventStatus(key)}
                >
                  <Text style={[s.statusText, eventStatus === key && { color: "#fff" }]}>
                    {key === "em_andamento" ? "Em andamento" : key.charAt(0).toUpperCase() + key.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Tabs */}
            <View style={s.pronTabs}>
              {(["dados", "prontuario", "historico"] as const).map((t) => (
                <TouchableOpacity key={t} style={[s.pronTab, prontuarioTab === t && s.pronTabActive]} onPress={() => setProntuarioTab(t)}>
                  <Text style={[s.pronTabText, prontuarioTab === t && s.pronTabTextActive]}>
                    {t === "dados" ? "Dados" : t === "prontuario" ? "Prontuário" : "Histórico"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={s.modalBody}>
              {prontuarioTab === "dados" && selectedEvent && (
                <View style={{ gap: 12 }}>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Tipo</Text>
                    <Text style={s.fieldValue}>{selectedEvent.title.split(" — ")[0]}</Text>
                  </View>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Horário</Text>
                    <Text style={s.fieldValue}>{fmtTime(selectedEvent.startH, selectedEvent.startM)} — {endTime(selectedEvent.startH, selectedEvent.startM, selectedEvent.durMin)}</Text>
                  </View>
                  {selectedEvent.clientName && (
                    <>
                      <View style={s.sectionHead}><Text style={s.sectionTitle}>Dados do Cliente</Text></View>
                      <View style={s.field}>
                        <Text style={s.fieldLabel}>Nome</Text>
                        <Text style={s.fieldValue}>{selectedEvent.clientName}</Text>
                      </View>
                      <View style={s.field}>
                        <Text style={s.fieldLabel}>Telefone</Text>
                        <Text style={s.fieldValue}>{selectedEvent.clientPhone}</Text>
                      </View>
                      <View style={s.field}>
                        <Text style={s.fieldLabel}>E-mail</Text>
                        <Text style={s.fieldValue}>{selectedEvent.clientEmail}</Text>
                      </View>
                    </>
                  )}
                  <View style={s.sectionHead}><Text style={s.sectionTitle}>Early Wins</Text></View>
                  {selectedEvent.earlyWins.map((w, i) => (
                    <View key={i} style={s.winRowModal}>
                      <View style={[s.winDot, { backgroundColor: C.secondary }]} />
                      <Text style={s.winTextModal}>{w}</Text>
                    </View>
                  ))}
                </View>
              )}
              {prontuarioTab === "prontuario" && (
                <View style={{ gap: 12 }}>
                  <View style={s.field}><Text style={s.fieldLabel}>Queixa principal</Text><Text style={s.fieldPlaceholder}>Registre a queixa principal...</Text></View>
                  <View style={s.field}><Text style={s.fieldLabel}>Observações da sessão</Text><Text style={s.fieldPlaceholder}>Notas sobre a sessão...</Text></View>
                  <View style={s.field}><Text style={s.fieldLabel}>Encaminhamentos</Text><Text style={s.fieldPlaceholder}>Próximos passos...</Text></View>
                </View>
              )}
              {prontuarioTab === "historico" && (
                <View style={s.emptyHistory}>
                  <Text style={s.emptyText}>Histórico do cliente será exibido aqui</Text>
                </View>
              )}
            </ScrollView>

            <View style={s.modalActions}>
              <TouchableOpacity style={s.closeBtn} onPress={() => setSelectedEvent(null)}>
                <Text style={s.closeBtnText}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={() => setSelectedEvent(null)}>
                <Text style={s.saveBtnText}>Salvar</Text>
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
  containerDark: { backgroundColor: "#12160F" },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(217,178,104,.12)" },
  online: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#7DB26E" },
  aiHeaderTitle: { color: "#F4EDE0", fontSize: 16, fontWeight: "700" },
  aiHeaderSub: { color: "#8A7F6A", fontSize: 11, marginTop: 2 },
  aiHeaderMore: { color: "#D9B268", letterSpacing: 2 },
  subTabs: { flexDirection: "row", backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 6, gap: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  subTab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  subTabActive: { backgroundColor: C.bg },
  subTabText: { fontSize: 13, fontWeight: "500", color: C.textMuted },
  subTabTextActive: { color: C.primary },

  dayContainer: { flex: 1, padding: 16 },
  dayTitle: { fontFamily: "serif", fontSize: 22, fontWeight: "600", color: C.primary },
  dayDate: { fontSize: 13, color: C.textMuted, marginBottom: 16, textTransform: "capitalize" },

  eventCard: { backgroundColor: C.surface, borderRadius: 10, padding: 12, marginBottom: 10, borderLeftWidth: 3, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  eventRow: { flexDirection: "row", gap: 10 },
  eventTime: { fontSize: 14, fontWeight: "600", color: C.primary, paddingTop: 1 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: "500", color: C.text },
  eventDur: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  winsContainer: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border, gap: 3 },
  winRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  winDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.secondary, marginTop: 5 },
  winText: { fontSize: 12, color: C.textMuted, flex: 1, lineHeight: 17 },

  statsRow: { flexDirection: "row", alignItems: "baseline", gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border, marginTop: 4 },
  statValue: { fontFamily: "serif", fontSize: 28, fontWeight: "600", color: C.primary },
  statLabel: { fontSize: 13, color: C.textMuted },
  busyTag: { marginLeft: "auto", backgroundColor: "#FFF3E0", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  busyText: { fontSize: 11, fontWeight: "600", color: "#E65100" },

  demoBanner: { backgroundColor: "rgba(217,178,104,.1)", paddingVertical: 8, paddingHorizontal: 16 },
  demoText: { fontSize: 12, color: "#D9B268", textAlign: "center" },

  messagesList: { padding: 16, gap: 8 },
  msgRow: { flexDirection: "row", marginBottom: 6 },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowAssistant: { justifyContent: "flex-start" },
  avatar: { width: 28, height: 28, marginRight: 8, marginTop: 4 },
  bubble: { maxWidth: "78%", padding: 12, borderRadius: 16 },
  bubbleUser: { backgroundColor: C.primary, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: "rgba(217,178,104,.1)", borderWidth: 1, borderColor: "rgba(217,178,104,.18)", borderBottomLeftRadius: 4 },
  msgText: { fontSize: 14, lineHeight: 21, color: "#F4EDE0" },
  msgTextUser: { color: C.textLight },
  msgTime: { fontSize: 10, color: C.textMuted, textAlign: "right", marginTop: 4 },
  msgTimeUser: { color: "rgba(245,240,232,0.5)" },

  loadingBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 6 },
  loadingText: { fontSize: 12, color: C.textMuted },

  inputArea: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, margin: 12, backgroundColor: "rgba(217,178,104,.1)", borderRadius: 24, borderWidth: 1, borderColor: "rgba(217,178,104,.2)" },
  micBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(217,178,104,.14)", justifyContent: "center", alignItems: "center" },
  micBtnRec: { backgroundColor: C.error },
  micIcon: { fontSize: 20 },
  input: { flex: 1, fontSize: 14, color: "#F4EDE0", paddingVertical: 6 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#B8873A", justifyContent: "center", alignItems: "center" },
  sendBtnOff: { opacity: 0.3 },
  sendIcon: { fontSize: 16, color: "#fff" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%", paddingBottom: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontFamily: "serif", fontSize: 18, fontWeight: "600", color: C.primary },
  modalClose: { fontSize: 20, color: C.textMuted, padding: 4 },

  statusBar: { paddingHorizontal: 16, paddingVertical: 10, flexGrow: 0 },
  statusBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: C.border, marginRight: 8 },
  statusText: { fontSize: 12, fontWeight: "500", color: C.textMuted },

  pronTabs: { flexDirection: "row", paddingHorizontal: 16, gap: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  pronTab: { paddingVertical: 10, paddingHorizontal: 16 },
  pronTabActive: { borderBottomWidth: 2, borderBottomColor: C.primary },
  pronTabText: { fontSize: 13, fontWeight: "500", color: C.textMuted },
  pronTabTextActive: { color: C.primary },

  modalBody: { padding: 20, maxHeight: 400 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldValue: { fontSize: 15, color: C.text, backgroundColor: C.bg, padding: 12, borderRadius: 8 },
  fieldPlaceholder: { fontSize: 14, color: C.textMuted, backgroundColor: C.bg, padding: 12, borderRadius: 8, fontStyle: "italic", minHeight: 80 },
  sectionHead: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: C.primary },
  winRowModal: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingLeft: 4 },
  winTextModal: { fontSize: 14, color: C.text, flex: 1, lineHeight: 20 },
  emptyHistory: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 14, color: C.textMuted },

  modalActions: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  closeBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  closeBtnText: { fontSize: 14, fontWeight: "500", color: C.textMuted },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: C.primary, alignItems: "center" },
  saveBtnText: { fontSize: 14, fontWeight: "500", color: C.textLight },
});
