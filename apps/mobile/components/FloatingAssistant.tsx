import { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authenticatedFetch } from "../services/auth";
import { RR } from "../config/theme";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const WELCOME: ChatMsg = {
  id: "w",
  role: "assistant",
  content:
    "Oi Fabi! Pode me pedir pra agendar, cadastrar cliente, gerar venda ou consultar o financeiro. O que precisa?",
};

interface Props {
  /** Hide the bubble when in the full IA tab. */
  hidden?: boolean;
}

export function FloatingAssistant({ hidden }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMsg>>(null);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    try {
      const res = await authenticatedFetch("/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao processar.");
      if (data.conversationId) setConversationId(data.conversationId);
      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: "assistant", content: data.message },
      ]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: e instanceof Error ? e.message : "Não consegui responder.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (hidden) return null;

  return (
    <>
      <TouchableOpacity
        style={s.fab}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <Text style={s.fabIcon}>✦</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.overlay}>
          <SafeAreaView style={s.sheet} edges={["bottom"]}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex: 1 }}
            >
              <View style={s.sheetHeader}>
                <View>
                  <Text style={s.sheetTitle}>Assistente da Fabi</Text>
                  <Text style={s.sheetSub}>Toque no × pra fechar</Text>
                </View>
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Text style={s.close}>×</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(m) => m.id}
                contentContainerStyle={s.list}
                renderItem={({ item }) => (
                  <View
                    style={[
                      s.bubble,
                      item.role === "user" ? s.userBubble : s.assistBubble,
                    ]}
                  >
                    <Text
                      style={
                        item.role === "user" ? s.userText : s.assistText
                      }
                    >
                      {item.content}
                    </Text>
                  </View>
                )}
                onContentSizeChange={() =>
                  listRef.current?.scrollToEnd({ animated: true })
                }
              />

              {loading && (
                <View style={s.typing}>
                  <ActivityIndicator size="small" color={RR.gold} />
                  <Text style={s.typingText}>pensando…</Text>
                </View>
              )}

              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Digite sua mensagem…"
                  placeholderTextColor={RR.muted}
                  multiline
                  editable={!loading}
                  returnKeyType="send"
                  onSubmitEditing={send}
                  blurOnSubmit
                />
                <TouchableOpacity
                  style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
                  onPress={send}
                  disabled={!input.trim() || loading}
                >
                  <Text style={s.sendBtnText}>Enviar</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 18,
    bottom: 82,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: RR.forest,
    borderWidth: 2,
    borderColor: RR.goldLight,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  fabIcon: { color: RR.goldLight, fontSize: 24 },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(26,46,24,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    height: "80%",
    backgroundColor: RR.ivory,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
  sheetHeader: {
    padding: 16,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: RR.forest,
  },
  sheetTitle: { color: RR.goldLight, fontFamily: "serif", fontSize: 18 },
  sheetSub: { color: RR.cream, fontSize: 11, opacity: 0.7, marginTop: 2 },
  close: { color: RR.goldLight, fontSize: 32, paddingHorizontal: 6 },

  list: { padding: 14, gap: 8, paddingBottom: 20 },
  bubble: {
    padding: 12,
    borderRadius: 14,
    maxWidth: "85%",
  },
  userBubble: {
    backgroundColor: RR.forest,
    alignSelf: "flex-end",
  },
  assistBubble: {
    backgroundColor: RR.white,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: RR.line,
  },
  userText: { color: RR.goldLight, fontSize: 14, lineHeight: 20 },
  assistText: { color: RR.forest, fontSize: 14, lineHeight: 20 },

  typing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  typingText: { color: RR.muted, fontSize: 12, fontStyle: "italic" },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: RR.line,
    backgroundColor: RR.white,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: RR.line,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    color: RR.forest,
    fontSize: 14,
    backgroundColor: RR.ivory,
  },
  sendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: RR.goldLight,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: RR.forest, fontWeight: "700", fontSize: 13 },
});
