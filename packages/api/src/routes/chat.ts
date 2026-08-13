import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { FabiAgent } from "@assistente-fabi/ai";
import { GoogleCalendarService } from "../services/google-calendar";
import { TranscriptionService } from "../services/transcription";
import { getAccessToken } from "./auth";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

let agent: FabiAgent | null = null;
let transcription: TranscriptionService | null = null;

function getAgent(): FabiAgent {
  if (!agent) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");
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

router.post("/message", async (req, res) => {
  try {
    const { message, conversationId, userId } = req.body;

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Mensagem é obrigatória" });
      return;
    }

    const accessToken = getAccessToken(userId || "default");
    if (!accessToken) {
      res.status(401).json({ error: "Não autenticado com Google Calendar. Faça login primeiro." });
      return;
    }

    const calendar = new GoogleCalendarService(accessToken);
    const convId = conversationId || uuidv4();
    const result = await getAgent().chat(message, convId, calendar);

    res.json(result);
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

    const { conversationId, userId } = req.body;

    const accessToken = getAccessToken(userId || "default");
    if (!accessToken) {
      res.status(401).json({ error: "Não autenticado com Google Calendar. Faça login primeiro." });
      return;
    }

    const text = await getTranscription().transcribe(file.buffer, file.mimetype);

    const calendar = new GoogleCalendarService(accessToken);
    const convId = conversationId || uuidv4();
    const result = await getAgent().chat(text, convId, calendar);

    res.json({
      ...result,
      transcription: text,
    });
  } catch (error) {
    console.error("Erro no voice:", error);
    res.status(500).json({ error: "Erro ao processar áudio" });
  }
});

export { router as chatRouter };
