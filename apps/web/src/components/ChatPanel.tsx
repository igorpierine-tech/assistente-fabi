"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./ChatPanel.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Message {
  role: "user" | "assistant";
  content: string;
  transcription?: string;
  timestamp: Date;
}

interface ChatPanelProps {
  userId: string;
  isDemo?: boolean;
}

const DEMO_RESPONSES: Record<string, string> = {
  default: "Desculpe, no modo demonstração só consigo responder a alguns comandos de exemplo. Tente perguntar sobre a agenda de hoje ou agendar uma Constelação!",
};

function getDemoResponse(input: string): string {
  const lower = input.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  if (lower.includes("agenda") && (lower.includes("hoje") || lower.includes("dia"))) {
    return `**Hoje, ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}**\n\n- 09:00 — Constelação — Maria Valentina\n- 11:00 — Consultoria Financeira — Ana Paula\n- 14:00 — Planejamento — Masterday Agosto\n- 15:30 — Constelação — Juliana Costa\n- 17:30 — Reunião — Raízes e Riquezas\n\nVocê tem 5 compromissos hoje. Dia bem cheio, Fabi!`;
  }

  if (lower.includes("bom dia") || lower.includes("ola") || lower.includes("oi")) {
    return `Bom dia, Fabi! Hoje você tem 5 compromissos. O primeiro é às 09:00 (Constelação com Maria Valentina) e o último às 17:30 (Reunião Raízes e Riquezas). Dia cheio! Quer ver os detalhes?`;
  }

  if (lower.includes("agend") && (lower.includes("constelac") || lower.includes("maria") || lower.includes("juliana"))) {
    const nome = lower.includes("juliana") ? "Juliana" : lower.includes("maria") ? "Maria" : "cliente";
    return `Vou agendar:\n\n📅 Constelação — ${nome.charAt(0).toUpperCase() + nome.slice(1)}\n🗓 Sexta-feira, 15 de agosto de 2026\n🕐 14:00 às 15:30\n🔔 Lembretes: 24h e 1h antes\n\nConfirmar?`;
  }

  if (lower.includes("sim") || lower.includes("confirm") || lower.includes("pode")) {
    return "✅ Agendado com sucesso! O compromisso já aparece na sua agenda.";
  }

  if (lower.includes("cancel")) {
    return "Qual compromisso você gostaria de cancelar? Me diga o nome do cliente ou o horário.";
  }

  if (lower.includes("horario") && lower.includes("livre") || lower.includes("disponiv")) {
    return "Na sexta-feira à tarde, você tem os seguintes horários livres:\n\n- 13:00 às 14:00\n- 16:00 às 18:00\n\nQuer que eu agende algo em algum desses horários?";
  }

  if (lower.includes("quantas constelac") || lower.includes("constelac") && lower.includes("agosto")) {
    return "Em agosto de 2026 você tem **12 Constelações** agendadas até o momento.";
  }

  return DEMO_RESPONSES.default;
}

export function ChatPanel({ userId, isDemo }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá, Fabi! Sou sua assistente de agenda. Você pode me perguntar sobre seus compromissos, pedir para agendar, alterar ou cancelar atendimentos. Use o microfone ou digite sua mensagem.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    if (isDemo) {
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));
      const response = getDemoResponse(text);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response, timestamp: new Date() },
      ]);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId, userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao processar mensagem");
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
    if (isDemo) {
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        sendMessage("Qual a minha agenda para hoje?");
      }, 2000);
      return;
    }

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
    if (isDemo) {
      setIsRecording(false);
      return;
    }
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
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

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

  return (
    <div className={styles.container}>
      {isDemo && (
        <div className={styles.demoBanner}>
          Modo demonstração — experimente digitar comandos como &quot;Qual minha agenda de hoje?&quot; ou &quot;Agende Constelação com Maria na sexta às 14h&quot;
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
