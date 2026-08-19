"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./ChatPanel.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Message {
  role: "user" | "assistant";
  content: string;
  transcription?: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatPanelProps {
  userId: string;
}

const WELCOME_MSG: Message = {
  role: "assistant",
  content: "Olá, Fabi! Sou sua assistente de agenda. Você pode me perguntar sobre seus compromissos, pedir para agendar, alterar ou cancelar atendimentos. Use o microfone ou digite sua mensagem.",
  timestamp: new Date(),
};

export function ChatPanel({ userId }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/chat/conversations`, { credentials: "include" });
      if (res.ok) {
        setConversations(await res.json());
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversation(conv: Conversation) {
    try {
      const res = await fetch(`${API_URL}/chat/conversations/${conv.id}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const loaded: Message[] = (data.messages || []).map((m: { role: string; content: string; created_at: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: new Date(m.created_at),
      }));
      setMessages(loaded.length > 0 ? loaded : [WELCOME_MSG]);
      setConversationId(conv.id);
      setShowHistory(false);
    } catch {
      // silent
    }
  }

  async function deleteConversation(id: string) {
    try {
      await fetch(`${API_URL}/chat/conversations/${id}`, { method: "DELETE", credentials: "include" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) {
        startNewChat();
      }
    } catch {
      // silent
    }
  }

  function startNewChat() {
    setConversationId(null);
    setMessages([WELCOME_MSG]);
    setShowHistory(false);
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat/message`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId, userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao processar mensagem");
      }

      if (!conversationId && data.conversationId) {
        fetchConversations();
      }
      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message, timestamp: new Date() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Desculpe, tive um problema ao processar sua mensagem. Tente novamente.",
          timestamp: new Date(),
        },
      ]);
    }

    setIsLoading(false);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        await sendVoice(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      alert("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function sendVoice(blob: Blob) {
    setIsLoading(true);

    const formData = new FormData();
    formData.append("audio", blob, "audio.webm");
    formData.append("userId", userId);
    if (conversationId) formData.append("conversationId", conversationId);

    try {
      const res = await fetch(`${API_URL}/chat/voice`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      if (!conversationId && data.conversationId) {
        fetchConversations();
      }
      setConversationId(data.conversationId);

      if (data.transcription) {
        setMessages((prev) => [
          ...prev,
          { role: "user", content: data.transcription, transcription: data.transcription, timestamp: new Date() },
        ]);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message, timestamp: new Date() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Desculpe, não consegui processar o áudio. Tente novamente ou digite sua mensagem.",
          timestamp: new Date(),
        },
      ]);
    }

    setIsLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function renderContent(text: string) {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      if (line.startsWith("- ")) {
        processed = processed.replace(/^- /, "");
        return <div key={i} className={styles.listItem} dangerouslySetInnerHTML={{ __html: "• " + processed }} />;
      }
      if (line.trim() === "") return <br key={i} />;
      return <p key={i} className={styles.textLine} dangerouslySetInnerHTML={{ __html: processed }} />;
    });
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className={styles.container}>
      <div className={styles.chatHeader}>
        <button className={styles.newChatBtn} onClick={startNewChat}>
          + Nova conversa
        </button>
        <button
          className={styles.historyToggle}
          onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchConversations(); }}
        >
          {showHistory ? "Fechar" : `Conversas (${conversations.length})`}
        </button>
      </div>

      {showHistory && (
        <div className={styles.historyPanel}>
          {conversations.length === 0 ? (
            <div className={styles.emptyHistory}>Nenhuma conversa salva</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`${styles.convItem} ${conv.id === conversationId ? styles.convItemActive : ""}`}
              >
                <button
                  className={styles.convTitle}
                  onClick={() => loadConversation(conv)}
                  style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit", padding: 0 }}
                >
                  {conv.title || "Sem título"}
                </button>
                <span className={styles.convDate}>{formatDate(conv.updated_at)}</span>
                <button
                  className={styles.convDelete}
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  title="Excluir conversa"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div className={styles.messages}>
        {messages.map((msg, i) => (
          <div key={i} className={`${styles.message} ${styles[msg.role]} animate-fade-in`}>
            {msg.role === "assistant" && (
              <div className={styles.avatar}>
                <img src="/logo-icon.png" alt="Assistente" width={24} height={24} style={{ objectFit: "contain" }} />
              </div>
            )}
            <div className={styles.bubble}>
              {msg.transcription && (
                <div className={styles.transcriptionTag}>Transcrito do áudio</div>
              )}
              <div className={styles.text}>{renderContent(msg.content)}</div>
              <span className={styles.time}>
                {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.avatar}>
                <img src="/logo-icon.png" alt="Assistente" width={24} height={24} style={{ objectFit: "contain" }} />
            </div>
            <div className={styles.bubble}>
              <div className={styles.typing}>
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        <button
          className={`${styles.micBtn} ${isRecording ? styles.recording : ""}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isLoading}
          title={isRecording ? "Parar gravação" : "Gravar áudio"}
        >
          {isRecording ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" fill="currentColor" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem ou use o microfone..."
          disabled={isLoading || isRecording}
        />
        <button
          className={styles.sendBtn}
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 10l14-7-7 14V10H3Z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}
