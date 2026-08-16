import { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, Modal,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiPost, apiGet, apiDelete } from "../../lib/api";

const C = {
  primary: "#1a2e18", primaryLight: "#2f4a2b", secondary: "#b8873a",
  gold: "#d9b268", goldLight: "#e8c880", bg: "#f4ede0", surface: "#fdfaf3",
  white: "#fff", text: "#1a2e18", textLight: "#f4ede0", textMuted: "#6b6152",
  textWarm: "#8a7f6a", border: "rgba(26,46,24,0.08)", borderSolid: "#c8bfae",
  error: "#e05a2b", chatBg: "#12160f",
};

const TYPE_COLORS: Record<string, string> = {
  constelacao: "#b8873a", consultoria: "#d9b268", planejamento: "#2f4a2b", reuniao: "#6b6152",
};

interface Message { id: string; role: "user" | "assistant"; content: string; timestamp: Date }

interface DayEvent {
  id: string; title: string; type: string; startH: number; startM: number; durMin: number;
  clientName?: string; clientPhone?: string; clientEmail?: string;
  earlyWins: string[];
}

interface Conversation {
  id: string; title: string | null; created_at: string; updated_at: string;
}

const DEMO_EVENTS: DayEvent[] = [
  { id: "1", title: "Constelação — Maria Valentina", type: "constelacao", startH: 9, startM: 0, durMin: 90, clientName: "Maria Valentina", clientPhone: "(65) 99812-3456", clientEmail: "maria.valentina@email.com", earlyWins: ["2a sessão — padrão de exclusão familiar identificado", "Preparar campo: mãe e avó materna", "Relatou melhora no relacionamento com a mãe"] },
  { id: "2", title: "Consultoria Financeira — Ana Paula", type: "consultoria", startH: 11, startM: 0, durMin: 60, clientName: "Ana Paula", clientPhone: "(65) 99734-5678", clientEmail: "ana.paula@email.com", earlyWins: ["Revisão do planejamento financeiro trimestral", "Atingiu 80% da meta de reserva de emergência", "Avaliar realocação pós-Selic"] },
  { id: "3", title: "Planejamento — Masterday Agosto", type: "planejamento", startH: 14, startM: 0, durMin: 60, earlyWins: ["Definir pauta e dinâmicas do Masterday", "12 participantes confirmados (máx. 15)", "Revisar material de apoio e checklist"] },
  { id: "4", title: "Constelação — Juliana Costa", type: "constelacao", startH: 15, startM: 30, durMin: 90, clientName: "Juliana Costa", clientPhone: "(65) 99623-7890", clientEmail: "juliana.costa@email.com", earlyWins: ["1a sessão — acolhimento e genograma", "Queixa: dificuldade de prosperar financeiramente", "Preparar dinâmica de pertencimento"] },
  { id: "5", title: "Reunião — Raízes e Riquezas", type: "reuniao", startH: 17, startM: 30, durMin: 30, earlyWins: ["Alinhamento de metas do mês", "Revisar agenda de setembro e Masterdays", "Feedback das consultorias em grupo"] },
];

const STATUS_COLORS: Record<string, string> = {
  previsto: "#d9b268", confirmado: "#7db26e", em_andamento: "#b8873a", concluido: "#6b6152", cancelado: "#e05a2b",
};

function getDemoResponse(input: string): string {
  const lower = input.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (lower.includes("agenda") && (lower.includes("hoje") || lower.includes("dia")))
    return `Bom dia, Fabi ☕ Hoje, ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}\n\n• 09:00 — Constelação — Maria Valentina\n• 11:00 — Consultoria Financeira — Ana Paula\n• 14:00 — Planejamento — Masterday Agosto\n• 15:30 — Constelação — Juliana Costa\n• 17:30 — Reunião — Raízes e Riquezas\n\nVocê tem 4 encontros hoje. A Marina chega às 9:30 — quer que eu prepare o resumo dela?`;
  if (lower.includes("bom dia") || lower.includes("ola") || lower.includes("oi"))
    return "Bom dia, Fabi ☕ Hoje você tem 5 atendimentos. O primeiro é às 09:00 (Constelação com Maria Valentina). Quer ver os detalhes?";
  if (lower.includes("agend") && (lower.includes("constelac") || lower.includes("maria")))
    return "Vou agendar:\n\nConstelação — Maria\nSexta-feira, 15 de agosto de 2026\n14:00 às 15:30\n\nConfirmar?";
  if (lower.includes("sim") || lower.includes("confirm"))
    return "Agendado com sucesso! O compromisso já aparece na sua agenda.";
  if (lower.includes("cancel"))
    return "Qual compromisso você gostaria de cancelar? Me diga o nome do cliente ou o horário.";
  if (lower.includes("horario") && lower.includes("livre") || lower.includes("disponiv"))
    return "Na sexta à tarde:\n\n• 13:00 às 14:00\n• 16:00 às 18:00\n\nQuer que eu agende algo?";
  return "No modo demonstração só consigo responder a alguns comandos de exemplo. Tente perguntar sobre a agenda de hoje!";
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
    { id: "welcome", role: "assistant", content: "Bom dia, Fabi ☕ Sou sua assistente de agenda. Pergunte qualquer coisa — sobre a semana, um cliente, um evento — e eu te ajudo.", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<DayEvent | null>(null);
  const [prontuarioTab, setProntuarioTab] = useState<"dados" | "prontuario" | "historico">("dados");
  const [eventStatus, setEventStatus] = useState("previsto");
  const [isDemo, setIsDemo] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      const session = await AsyncStorage.getItem("fabi_session");
      if (session) { setIsDemo(false); fetchConversations(); }
    })();
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiGet("/chat/conversations");
      if (res.ok) setConversations(await res.json());
    } catch {}
  }, []);

  async function loadConversation(conv: Conversation) {
    try {
      const res = await apiGet(`/chat/conversations/${conv.id}`);
      if (!res.ok) return;
      const data = await res.json();
      const loaded: Message[] = (data.messages || []).map((m: { role: string; content: string; created_at: string }, i: number) => ({
        id: `loaded-${i}`, role: m.role as "user" | "assistant", content: m.content, timestamp: new Date(m.created_at),
      }));
      setMessages(loaded.length > 0 ? loaded : [messages[0]]);
      setConversationId(conv.id);
      setShowHistory(false);
    } catch {}
  }

  async function deleteConversation(id: string) {
    try {
      await apiDelete(`/chat/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) startNewChat();
    } catch {}
  }

  function startNewChat() {
    setConversationId(null);
    setMessages([messages[0]]);
    setShowHistory(false);
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    if (isDemo) {
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: getDemoResponse(text), timestamp: new Date() }]);
      setIsLoading(false);
      return;
    }

    try {
      const res = await apiPost("/chat/message", { message: text, conversationId });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      if (!conversationId && data.conversationId) fetchConversations();
      setConversationId(data.conversationId);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: data.message, timestamp: new Date() }]);
    } catch {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: "Desculpe, tive um problema. Tente novamente.", timestamp: new Date() }]);
    }
    setIsLoading(false);
  }

  function toggleRecording() {
    if (isRecording) { setIsRecording(false); sendMessage("Qual a minha agenda para hoje?"); return; }
    setIsRecording(true);
    setTimeout(() => { setIsRecording(false); sendMessage("Qual a minha agenda para hoje?"); }, 2500);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <SafeAreaView style={s.container} edges={["bottom"]}>
      <View style={s.subTabs}>
        <TouchableOpacity style={[s.subTab, tab === "dia" && s.subTabActive]} onPress={() => setTab("dia")}>
          <Text style={[s.subTabText, tab === "dia" && s.subTabTextActive]}>Resumo do Dia</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.subTab, tab === "chat" && s.subTabActive]} onPress={() => setTab("chat")}>
          <Text style={[s.subTabText, tab === "chat" && s.subTabTextActive]}>Assistente IA</Text>
        </TouchableOpacity>
      </View>

      {tab === "dia" ? (
        <ScrollView style={s.dayContainer} contentContainerStyle={{ paddingBottom: 24 }}>
          {/* Hero Card */}
          <LinearGradient colors={["#1a2e18", "#2f4a2b"]} style={s.heroCard}>
            <Text style={s.heroLabel}>HOJE · {today.toUpperCase()}</Text>
            <Text style={s.heroTitle}>
              {DEMO_EVENTS.length} <Text style={s.heroTitleGold}>encontros</Text>{"\n"}agendados
            </Text>
            <View style={s.heroRow}>
              <View style={s.heroNext}>
                <Text style={s.heroNextLabel}>PRÓXIMO</Text>
                <Text style={s.heroNextValue}>{fmtTime(DEMO_EVENTS[0].startH, DEMO_EVENTS[0].startM)} · {DEMO_EVENTS[0].title.split(" — ")[1]}</Text>
              </View>
            </View>
          </LinearGradient>

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
              {ev.earlyWins.length > 0 && (
                <View style={s.winsContainer}>
                  {ev.earlyWins.map((w, i) => (
                    <View key={i} style={s.winRow}>
                      <View style={s.winDot} />
                      <Text style={s.winText}>{w}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, backgroundColor: C.chatBg }}>
          {!isDemo && (
            <View style={s.chatHeader}>
              <TouchableOpacity style={s.newChatBtn} onPress={startNewChat}>
                <Text style={s.newChatText}>+ Nova</Text>
              </TouchableOpacity>
              <View style={s.chatHeaderInfo}>
                <View style={s.onlineDot} />
                <Text style={s.chatHeaderTitle}>Assistente Raízes</Text>
              </View>
              <TouchableOpacity
                style={s.historyBtn}
                onPress={() => { setShowHistory(!showHistory); if (!showHistory) fetchConversations(); }}
              >
                <Text style={s.historyBtnText}>{showHistory ? "✕" : `${conversations.length}`}</Text>
              </TouchableOpacity>
            </View>
          )}

          {isDemo && (
            <View style={s.chatHeaderDemo}>
              <View style={s.onlineDot} />
              <View>
                <Text style={s.chatHeaderTitle}>Assistente Raízes</Text>
                <Text style={s.chatHeaderSub}>Modo demonstração</Text>
              </View>
            </View>
          )}

          {showHistory && !isDemo && (
            <View style={s.historyPanel}>
              {conversations.length === 0 ? (
                <Text style={s.historyEmpty}>Nenhuma conversa salva</Text>
              ) : (
                <ScrollView style={{ maxHeight: 200 }}>
                  {conversations.map((conv) => (
                    <View key={conv.id} style={[s.convItem, conv.id === conversationId && s.convItemActive]}>
                      <TouchableOpacity style={s.convInfo} onPress={() => loadConversation(conv)}>
                        <Text style={s.convTitle} numberOfLines={1}>{conv.title || "Sem título"}</Text>
                        <Text style={s.convDate}>{formatDate(conv.updated_at)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.convDeleteBtn} onPress={() => deleteConversation(conv.id)}>
                        <Text style={s.convDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={[s.msgRow, item.role === "user" ? s.msgRowUser : s.msgRowAssistant]}>
                {item.role === "assistant" && (
                  <LinearGradient colors={["#b8873a", "#e8c880"]} style={s.aiAvatar}>
                    <Text style={{ fontSize: 12, color: "#12160f" }}>✦</Text>
                  </LinearGradient>
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
              <ActivityIndicator size="small" color={C.gold} />
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
                placeholder="Pergunte qualquer coisa..." placeholderTextColor="#6b6152"
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
        </View>
      )}

      {/* Event Detail Modal */}
      <Modal visible={!!selectedEvent} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Detalhes do Agendamento</Text>
              <TouchableOpacity onPress={() => setSelectedEvent(null)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

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
                      <View style={s.field}><Text style={s.fieldLabel}>Nome</Text><Text style={s.fieldValue}>{selectedEvent.clientName}</Text></View>
                      <View style={s.field}><Text style={s.fieldLabel}>Telefone</Text><Text style={s.fieldValue}>{selectedEvent.clientPhone}</Text></View>
                      <View style={s.field}><Text style={s.fieldLabel}>E-mail</Text><Text style={s.fieldValue}>{selectedEvent.clientEmail}</Text></View>
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
                <View style={s.emptyHistory}><Text style={s.emptyText}>Histórico do cliente será exibido aqui</Text></View>
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
  subTab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  subTabActive: { backgroundColor: C.primary },
  subTabText: { fontSize: 13, fontWeight: "500", color: C.textMuted },
  subTabTextActive: { color: C.gold },

  // Day view
  dayContainer: { flex: 1, padding: 16 },
  heroCard: { borderRadius: 22, padding: 22, marginBottom: 16 },
  heroLabel: { fontSize: 10, letterSpacing: 1.4, color: C.gold, fontWeight: "600" },
  heroTitle: { fontFamily: "serif", fontSize: 32, lineHeight: 36, color: C.textLight, marginTop: 8 },
  heroTitleGold: { fontStyle: "italic", color: C.gold },
  heroRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  heroNext: { flex: 1, padding: 10, backgroundColor: "rgba(217,178,104,0.15)", borderWidth: 1, borderColor: "rgba(217,178,104,0.3)", borderRadius: 12 },
  heroNextLabel: { fontSize: 10, color: C.gold, letterSpacing: 0.8 },
  heroNextValue: { fontSize: 14, fontWeight: "600", color: C.textLight, marginTop: 3 },

  eventCard: { backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  eventRow: { flexDirection: "row", gap: 10 },
  eventTime: { fontSize: 14, fontWeight: "600", color: C.primary, paddingTop: 1 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: "500", color: C.text },
  eventDur: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  winsContainer: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border, gap: 3 },
  winRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  winDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.secondary, marginTop: 5 },
  winText: { fontSize: 12, color: C.textMuted, flex: 1, lineHeight: 17 },

  // Chat
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(217,178,104,0.1)" },
  chatHeaderDemo: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(217,178,104,0.1)" },
  chatHeaderInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#7db26e", shadowColor: "#7db26e", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4 },
  chatHeaderTitle: { fontSize: 15, fontWeight: "600", color: C.textLight },
  chatHeaderSub: { fontSize: 11, color: C.textWarm, marginTop: 1 },
  newChatBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(217,178,104,0.12)" },
  newChatText: { fontSize: 12, fontWeight: "500", color: C.gold },
  historyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(217,178,104,0.12)", justifyContent: "center", alignItems: "center" },
  historyBtnText: { fontSize: 12, fontWeight: "600", color: C.gold },

  historyPanel: { backgroundColor: "rgba(217,178,104,0.06)", borderBottomWidth: 1, borderBottomColor: "rgba(217,178,104,0.1)" },
  historyEmpty: { padding: 16, textAlign: "center", color: C.textWarm, fontSize: 13 },
  convItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(217,178,104,0.08)" },
  convItemActive: { backgroundColor: "rgba(217,178,104,0.1)" },
  convInfo: { flex: 1, gap: 2 },
  convTitle: { fontSize: 13, color: C.textLight, fontWeight: "500" },
  convDate: { fontSize: 11, color: C.textWarm },
  convDeleteBtn: { padding: 6 },
  convDeleteText: { fontSize: 14, color: C.textWarm },

  messagesList: { padding: 16, gap: 14 },
  msgRow: { flexDirection: "row", marginBottom: 2 },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowAssistant: { justifyContent: "flex-start" },
  aiAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8, marginTop: 4, justifyContent: "center", alignItems: "center" },
  bubble: { maxWidth: "78%", padding: 12, borderRadius: 16 },
  bubbleUser: { backgroundColor: C.primaryLight, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: "rgba(217,178,104,0.1)", borderWidth: 1, borderColor: "rgba(217,178,104,0.18)", borderTopLeftRadius: 4 },
  msgText: { fontSize: 14, lineHeight: 21, color: C.textLight },
  msgTextUser: { color: C.textLight },
  msgTime: { fontSize: 10, color: C.textWarm, textAlign: "right", marginTop: 4 },
  msgTimeUser: { color: "rgba(244,237,224,0.4)" },

  loadingBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 6 },
  loadingText: { fontSize: 12, color: C.textWarm },

  inputArea: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, margin: 12, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, borderWidth: 1, borderColor: "rgba(217,178,104,0.15)" },
  micBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(217,178,104,0.12)", justifyContent: "center", alignItems: "center" },
  micBtnRec: { backgroundColor: C.error },
  micIcon: { fontSize: 20 },
  input: { flex: 1, fontSize: 14, color: C.textLight, paddingVertical: 6 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.gold, justifyContent: "center", alignItems: "center" },
  sendBtnOff: { opacity: 0.3 },
  sendIcon: { fontSize: 16, color: C.primary },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "90%", paddingBottom: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontFamily: "serif", fontSize: 18, fontWeight: "600", color: C.primary },
  modalClose: { fontSize: 20, color: C.textMuted, padding: 4 },

  statusBar: { paddingHorizontal: 16, paddingVertical: 10, flexGrow: 0 },
  statusBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: C.border, marginRight: 8 },
  statusText: { fontSize: 12, fontWeight: "500", color: C.textMuted },

  pronTabs: { flexDirection: "row", paddingHorizontal: 16, gap: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  pronTab: { paddingVertical: 10, paddingHorizontal: 16 },
  pronTabActive: { borderBottomWidth: 2, borderBottomColor: C.secondary },
  pronTabText: { fontSize: 13, fontWeight: "500", color: C.textMuted },
  pronTabTextActive: { color: C.primary },

  modalBody: { padding: 20, maxHeight: 400 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 10, fontWeight: "600", color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },
  fieldValue: { fontSize: 15, color: C.text, backgroundColor: C.white, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border },
  fieldPlaceholder: { fontSize: 14, color: C.textMuted, backgroundColor: C.white, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border, fontStyle: "italic", minHeight: 80 },
  sectionHead: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: C.primary },
  winRowModal: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingLeft: 4 },
  winTextModal: { fontSize: 14, color: C.text, flex: 1, lineHeight: 20 },
  emptyHistory: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 14, color: C.textMuted },

  modalActions: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  closeBtn: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  closeBtnText: { fontSize: 14, fontWeight: "500", color: C.textMuted },
  saveBtn: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: C.primary, alignItems: "center" },
  saveBtnText: { fontSize: 14, fontWeight: "500", color: C.gold },
});
