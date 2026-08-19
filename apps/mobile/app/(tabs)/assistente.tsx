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

const DEMO_EVENTS: DayEvent[] = [
  { id: "1", title: "Constelação — Maria Valentina", type: "constelacao", startH: 9, startM: 0, durMin: 90, clientName: "Maria Valentina", clientPhone: "(65) 99812-3456", clientEmail: "maria.valentina@email.com", earlyWins: ["2a sessão — padrão de exclusão familiar identificado", "Preparar campo: mãe e avó materna", "Relatou melhora no relacionamento com a mãe"] },
  { id: "2", title: "Consultoria Financeira — Ana Paula", type: "consultoria", startH: 11, startM: 0, durMin: 60, clientName: "Ana Paula", clientPhone: "(65) 99734-5678", clientEmail: "ana.paula@email.com", earlyWins: ["Revisão do planejamento financeiro trimestral", "Atingiu 80% da meta de reserva de emergência", "Avaliar realocação pós-Selic"] },
  { id: "3", title: "Planejamento — Masterday Agosto", type: "planejamento", startH: 14, startM: 0, durMin: 60, earlyWins: ["Definir pauta e dinâmicas do Masterday", "12 participantes confirmados (máx. 15)", "Revisar material de apoio e checklist"] },
  { id: "4", title: "Constelação — Juliana Costa", type: "constelacao", startH: 15, startM: 30, durMin: 90, clientName: "Juliana Costa", clientPhone: "(65) 99623-7890", clientEmail: "juliana.costa@email.com", earlyWins: ["1a sessão — acolhimento e genograma", "Queixa: dificuldade de prosperar financeiramente", "Preparar dinâmica de pertencimento"] },
  { id: "5", title: "Reunião — Raízes e Riquezas", type: "reuniao", startH: 17, startM: 30, durMin: 30, earlyWins: ["Alinhamento de metas do mês", "Revisar agenda de setembro e Masterdays", "Feedback das consultorias em grupo"] },
];

const STATUS_COLORS: Record<string, string> = {
  previsto: "#FFA726", confirmado: "#66BB6A", em_andamento: "#42A5F5", concluido: "#78909C", cancelado: "#EF5350",
};

function getDemoResponse(input: string): string {
  const lower = input.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (lower.includes("agenda") && (lower.includes("hoje") || lower.includes("dia")))
    return `Hoje, ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}\n\n• 09:00 — Constelação — Maria Valentina\n• 11:00 — Consultoria Financeira — Ana Paula\n• 14:00 — Planejamento — Masterday Agosto\n• 15:30 — Constelação — Juliana Costa\n• 17:30 — Reunião — Raízes e Riquezas\n\nVocê tem 5 compromissos hoje. Dia bem cheio, Fabi!`;
  if (lower.includes("bom dia") || lower.includes("ola") || lower.includes("oi"))
    return "Bom dia, Fabi! Hoje você tem 5 compromissos. O primeiro é às 09:00 (Constelação com Maria Valentina) e o último às 17:30 (Reunião Raízes e Riquezas). Quer ver os detalhes?";
  if (lower.includes("agend") && (lower.includes("constelac") || lower.includes("maria")))
    return "Vou agendar:\n\nConstelação — Maria\nSexta-feira, 15 de agosto de 2026\n14:00 às 15:30\nLembretes: 24h e 1h antes\n\nConfirmar?";
  if (lower.includes("sim") || lower.includes("confirm"))
    return "Agendado com sucesso! O compromisso já aparece na sua agenda.";
  if (lower.includes("cancel"))
    return "Qual compromisso você gostaria de cancelar? Me diga o nome do cliente ou o horário.";
  if (lower.includes("horario") && lower.includes("livre") || lower.includes("disponiv"))
    return "Na sexta à tarde, horários livres:\n\n• 13:00 às 14:00\n• 16:00 às 18:00\n\nQuer que eu agende algo?";
  return "No modo demonstração só consigo responder a alguns comandos de exemplo. Tente perguntar sobre a agenda de hoje ou agendar uma Constelação!";
}

function pad(n: number) { return n.toString().padStart(2, "0"); }
function fmtTime(h: number, m: number) { return `${pad(h)}:${pad(m)}`; }
function endTime(h: number, m: number, dur: number) {
  const totalM = h * 60 + m + dur;
  return fmtTime(Math.floor(totalM / 60), totalM % 60);
}

export default function AssistenteScreen() {
  const [tab, setTab] = useState<"dia" | "chat">("dia");
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

  async function toggleRecording() {
    if (isRecording) {
      setIsRecording(false);
      if (recording) {
        await recording.stopAndUnloadAsync();
        setRecording(null);
      }
      sendMessage("Qual a minha agenda para hoje?");
      return;
    }
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        rec.stopAndUnloadAsync();
        setRecording(null);
        sendMessage("Qual a minha agenda para hoje?");
      }, 2500);
    } catch {
      setIsRecording(false);
      sendMessage("Qual a minha agenda para hoje?");
    }
  }

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <SafeAreaView style={s.container} edges={["bottom"]}>
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

          {DEMO_EVENTS.map((ev) => (
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
          ))}

          <View style={s.statsRow}>
            <Text style={s.statValue}>{DEMO_EVENTS.length}</Text>
            <Text style={s.statLabel}>compromissos</Text>
            <View style={s.busyTag}><Text style={s.busyText}>Dia cheio</Text></View>
          </View>
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

  demoBanner: { backgroundColor: "#FFF8E1", paddingVertical: 8, paddingHorizontal: 16 },
  demoText: { fontSize: 12, color: "#F57F17", textAlign: "center" },

  messagesList: { padding: 16, gap: 8 },
  msgRow: { flexDirection: "row", marginBottom: 6 },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowAssistant: { justifyContent: "flex-start" },
  avatar: { width: 28, height: 28, marginRight: 8, marginTop: 4 },
  bubble: { maxWidth: "78%", padding: 12, borderRadius: 16 },
  bubbleUser: { backgroundColor: C.primary, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4 },
  msgText: { fontSize: 14, lineHeight: 21, color: C.text },
  msgTextUser: { color: C.textLight },
  msgTime: { fontSize: 10, color: C.textMuted, textAlign: "right", marginTop: 4 },
  msgTimeUser: { color: "rgba(245,240,232,0.5)" },

  loadingBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 6 },
  loadingText: { fontSize: 12, color: C.textMuted },

  inputArea: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, margin: 12, backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  micBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" },
  micBtnRec: { backgroundColor: C.error },
  micIcon: { fontSize: 20 },
  input: { flex: 1, fontSize: 14, color: C.text, paddingVertical: 6 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.secondary, justifyContent: "center", alignItems: "center" },
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
