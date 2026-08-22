import { Router, type Request, type Router as ExpressRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import { FabiAgent } from "@assistente-fabi/ai";
import { GoogleCalendarService } from "../services/google-calendar";
import { SyncedCalendarService } from "../services/synced-calendar";
import { TranscriptionService } from "../services/transcription";
import { buildWorkspaceService } from "../services/workspace-service";
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
import { requireGoogleCalendar, requireUser } from "../middleware/auth";
import { rateLimit } from "../middleware/security";
import { optionalId, requiredString, ValidationError } from "../services/validation";

const router: ExpressRouter = Router();
router.use(requireUser);
router.param("id", (req, _res, next, value) => {
  optionalId(value, "ID da conversa");
  next();
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const MAX_MESSAGE_LENGTH = 2000;
const ALLOWED_AUDIO_TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/x-m4a"]);

const aiLimiter = rateLimit({ prefix: "ai", windowMs: 60_000, max: 20 });

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
  const user = req.session.googleUser!;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

function resolveConversation(
  requestedId: unknown,
  user: { id: string; name?: string; email?: string },
  firstMessage: string
) {
  if (requestedId !== undefined && typeof requestedId !== "string") return null;
  if (typeof requestedId === "string") {
    const conversation = getConversation(user.id, requestedId);
    return conversation ? { id: conversation.id, isNew: false } : null;
  }
  const id = uuidv4();
  createConversation({
    id,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    title: generateTitle(firstMessage),
  });
  return { id, isNew: true };
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
  return new SyncedCalendarService(gcal, req.session.googleUser!.id);
}

// --- Chat endpoints ---

router.post("/message", requireGoogleCalendar, aiLimiter, async (req, res) => {
  try {
    const message = requiredString(req.body?.message, "Mensagem", MAX_MESSAGE_LENGTH);
    const conversationId = optionalId(req.body?.conversationId, "ID da conversa");

    const user = getUserFromSession(req);
    const conversation = resolveConversation(conversationId, user, message);
    if (!conversation) {
      res.status(404).json({ error: "Conversa não encontrada" });
      return;
    }
    const { id: convId, isNew } = conversation;
    addMessage(user.id, convId, "user", message);

    const calendar = calendarForSession(req);

    if (isTodayAgendaQuestion(message)) {
      const events = await calendar.listToday();
      const reply = formatToday(events);
      addMessage(user.id, convId, "assistant", reply);
      res.json({ message: reply, conversationId: convId, events, user: { name: user.name } });
      return;
    }

    const workspace = buildWorkspaceService(user.id);
    const result = await getAgent().chat(message, convId, calendar, user.name, workspace);

    addMessage(user.id, convId, "assistant", result.message);

    if (isNew && result.message) {
      updateConversationTitle(user.id, convId, generateTitle(message));
    }

    res.json({ ...result, user: { name: user.name } });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Erro no chat:", error);
    res.status(500).json({ error: "Erro ao processar mensagem" });
  }
});

router.post("/voice", requireGoogleCalendar, aiLimiter, upload.single("audio"), async (req, res) => {
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

    const conversationId = optionalId(req.body?.conversationId, "ID da conversa");

    const text = await getTranscription().transcribe(file.buffer, file.mimetype);
    const user = getUserFromSession(req);
    const conversation = resolveConversation(conversationId, user, text);
    if (!conversation) {
      res.status(404).json({ error: "Conversa não encontrada" });
      return;
    }
    const { id: convId, isNew } = conversation;
    addMessage(user.id, convId, "user", text);

    const calendar = calendarForSession(req);
    const workspace = buildWorkspaceService(user.id);
    const result = await getAgent().chat(text, convId, calendar, user.name, workspace);

    addMessage(user.id, convId, "assistant", result.message);

    if (isNew) {
      updateConversationTitle(user.id, convId, generateTitle(text));
    }

    res.json({
      ...result,
      transcription: text,
      user: { name: user.name },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Erro no voice:", error);
    res.status(500).json({ error: "Erro ao processar áudio" });
  }
});

// --- Conversation history endpoints ---

router.get("/conversations", (req, res) => {
  const user = getUserFromSession(req);
  const requestedLimit = Number(req.query.limit ?? 50);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 50;
  const conversations = listConversations(user.id, limit);
  res.json(conversations);
});

router.get("/conversations/:id", (req, res) => {
  const user = getUserFromSession(req);
  const conv = getConversation(user.id, req.params.id);
  if (!conv) {
    res.status(404).json({ error: "Conversa não encontrada" });
    return;
  }
  const messages = getMessages(user.id, req.params.id);
  res.json({ ...conv, messages });
});

router.delete("/conversations/:id", (req, res) => {
  const user = getUserFromSession(req);
  const conv = getConversation(user.id, req.params.id);
  if (!conv) {
    res.status(404).json({ error: "Conversa não encontrada" });
    return;
  }
  deleteConversation(user.id, req.params.id);
  res.status(204).end();
});

export { router as chatRouter };
