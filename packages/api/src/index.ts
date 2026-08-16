import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { chatRouter } from "./routes/chat";
import { clientsRouter } from "./routes/clients";
import { appointmentsRouter } from "./routes/appointments";
import { EncryptedSessionStore } from "./services/encrypted-session-store";
import { getDb } from "./services/database";
import "./session-types";

const app = express();
const port = parseInt(process.env.PORT || process.env.API_PORT || "3001", 10);
const isProduction = process.env.NODE_ENV === "production";
app.set("trust proxy", 1);
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET não configurada. Consulte o SETUP.md.");
}
if (!process.env.GOOGLE_REDIRECT_URI) {
  throw new Error("GOOGLE_REDIRECT_URI não configurada. Consulte o SETUP.md.");
}

const extraOrigins = (process.env.EXTRA_WEB_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: [
    process.env.WEB_URL || "http://localhost:3000",
    "http://localhost:3000",
    "exp://localhost:8081",
    "http://localhost:8081",
    "http://10.0.2.2:3001",
    ...extraOrigins,
  ],
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(session({
  name: "fabi.sid",
  store: new EncryptedSessionStore(
    process.env.SESSION_FILE || "./data/sessions.enc.json",
    sessionSecret
  ),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
}));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "Assistente da Fabi API" });
});

app.use("/auth", authRouter);
app.use("/chat", chatRouter);
app.use("/clients", clientsRouter);
app.use("/appointments", appointmentsRouter);

getDb();

app.listen(port, () => {
  console.log(`Assistente da Fabi API rodando na porta ${port}`);
});
