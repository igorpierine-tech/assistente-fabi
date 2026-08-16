import { Router, type Request, type Router as ExpressRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import { FabiAgent } from "@assistente-fabi/ai";
import { GoogleCalendarService } from "../services/google-calendar";
import { SyncedCalendarService } from "../services/synced-calendar";
import { TranscriptionService } from "../services/transcription";
import {
  getConversation,
  createConversation,
  addMessage,
  generateTitle,
  updateConversationTitle,
  listConversations,
  getMessages,
  deleteConversation,
} from "../services/database";
import multer from "multer";
import "../session-types";

const router: ExpressRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const MAX_MESSAGE_LENGTH = 2000;
const ALLOWED_AUDIO_TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/x-m4a"]);

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

function isRateLimited(sessionId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(sessionId) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  rateLimitMap.set(sessionId, recent);
  return recent.length > RATE_LIMIT_MAX;
}

let agent: FabiAgent | null = null;
let transcription: TranscriptionService | null = null;

function getAgent(): FabiAgent {
  if (!agent) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");
    agent = new FabiAgent(apiKey);
  }
  return agent;
}

function getTranscription(): TranscriptionService {
  if (!transcription) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");
    transcription = new TranscriptionService(apiKey);
  }
  return transcription;
}

function getUserFromSession(req: Request) {
  const user = req.session.googleUser;
  return {
    id: user?.id || req.sessionID,
    name: user?.name || "Usuário",
    email: user?.email,
  };
}

function ensureConversation(convId: string, user: { id: string; name?: string; email?: string }, firstMessage?: string) {
  let conv = getConversation(convId);
  if (!conv) {
    conv = createConversation({
      id: convId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      title: firstMessage ? generateTitle(firstMessage) : undefined,
    });
  }
  return conv;
}

function isTodayAgendaQuestion(message: string): boolean {
  const normalized = message.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR").replace(/[?!.,]/g, "").trim();
  return normalized === "qual minha agenda de hoje" || normalized === "qual a minha agenda de hoje";
}

function formatToday(events: Awaited<ReturnType<GoogleCalendarService["listToday"]>>): string {
  if (!events.length) return "Você não tem compromissos hoje.";
  const clock = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Cuiaba", hour: "2-digit", minute: "2-digit",
  });
  const lines = events.map((event) => {
    if (event.start && /^\d{4}-\d{2}-\d{2}$/.test(event.start)) return `- Dia inteiro — ${event.title}`;
    const start = event.start ? clock.format(new Date(event.start)) : "--:--";
    const end = event.end ? clock.format(new Date(event.end)) : null;
    return `- ${start}${end ? `–${end}` : ""} — ${event.title}`;
  });
  return `Sua agenda de hoje:\n\n${lines.join("\n")}`;
}

function calendarForSession(req: Request): SyncedCalendarService {
  const gcal = new GoogleCalendarService(req.session.googleTokens!, (tokens) => {
    req.session.googleTokens = { ...req.session.googleTokens, ...tokens };
  });
  return new SyncedCalendarService(gcal);
}

// --- Chat endpoints ---

router.post("/message", async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Mensagem é obrigatória" });
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: `Mensagem excede o limite de ${MAX_MESSAGE_LENGTH} caracteres` });
      return;
    }

    if (isRateLimited(req.sessionID)) {
      res.status(429).json({ error: "Muitas requisições. Aguarde um momento." });
      return;
    }

    if (!req.session.googleTokens) {
      res.status(401).json({ error: "Não autenticado com Google Calendar. Faça login primeiro." });
      return;
    }

    const user = getUserFromSession(req);
    const convId = conversationId || uuidv4();
    const isNew = !getConversation(convId);

    ensureConversation(convId, user, message);
    addMessage(convId, "user", message);

    const calendar = calendarForSession(req);

    if (isTodayAgendaQuestion(message)) {
      const events = await calendar.listToday();
      const reply = formatToday(events);
      addMessage(convId, "assistant", reply);
      res.json({ message: reply, conversationId: convId, events, user: { name: user.name } });
      return;
    }

    const result = await getAgent().chat(message, convId, calendar, user.name);

    addMessage(convId, "assistant", result.message);

    if (isNew && result.message) {
      updateConversationTitle(convId, generateTitle(message));
    }

    res.json({ ...result, user: { name: user.name } });
  } catch (error) {
    console.error("Erro no chat:", error);
    res.status(500).json({ error: "Erro ao processar mensagem" });
  }
});

router.post("/voice", upload.single("audio"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Arquivo de áudio é obrigatório" });
      return;
    }

    if (!ALLOWED_AUDIO_TYPES.has(file.mimetype)) {
      res.status(400).json({ error: "Tipo de arquivo não suportado. Envie áudio em webm, mp4, mp3, wav ou ogg." });
      return;
    }

    if (isRateLimited(req.sessionID)) {
      res.status(429).json({ error: "Muitas requisições. Aguarde um momento." });
      return;
    }

    const { conversationId } = req.body;

    if (!req.session.googleTokens) {
      res.status(401).json({ error: "Não autenticado com Google Calendar. Faça login primeiro." });
      return;
    }

    const text = await getTranscription().transcribe(file.buffer, file.mimetype);
    const user = getUserFromSession(req);
    const convId = conversationId || uuidv4();
    const isNew = !getConversation(convId);

    ensureConversation(convId, user, text);
    addMessage(convId, "user", text);

    const calendar = calendarForSession(req);
    const result = await getAgent().chat(text, convId, calendar, user.name);

    addMessage(convId, "assistant", result.message);

    if (isNew) {
      updateConversationTitle(convId, generateTitle(text));
    }

    res.json({
      ...result,
      transcription: text,
      user: { name: user.name },
    });
  } catch (error) {
    console.error("Erro no voice:", error);
    res.status(500).json({ error: "Erro ao processar áudio" });
  }
});

// --- Conversation history endpoints ---

router.get("/conversations", (req, res) => {
  if (!req.session.googleUser) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  const user = getUserFromSession(req);
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const conversations = listConversations(user.id, limit);
  res.json(conversations);
});

router.get("/conversations/:id", (req, res) => {
  const conv = getConversation(req.params.id);
  if (!conv) {
    res.status(404).json({ error: "Conversa não encontrada" });
    return;
  }
  const user = getUserFromSession(req);
  if (conv.user_id !== user.id) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  const messages = getMessages(req.params.id);
  res.json({ ...conv, messages });
});

router.delete("/conversations/:id", (req, res) => {
  const conv = getConversation(req.params.id);
  if (!conv) {
    res.status(404).json({ error: "Conversa não encontrada" });
    return;
  }
  const user = getUserFromSession(req);
  if (conv.user_id !== user.id) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  deleteConversation(req.params.id);
  res.status(204).end();
});

export { router as chatRouter };
