import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { chatRouter } from "./routes/chat";
import { clientsRouter } from "./routes/clients";
import { appointmentsRouter } from "./routes/appointments";
import { adminRouter } from "./routes/admin";
import { bookingRouter } from "./routes/booking";
import { publicBookingRouter } from "./routes/public-booking";
import { EncryptedSessionStore } from "./services/encrypted-session-store";
import { getDb } from "./services/database";
import { isValidSignedSession } from "./services/mobile-auth";
import { rateLimit, requireTrustedOrigin, securityHeaders } from "./middleware/security";
import { ValidationError } from "./services/validation";
import { privacyRouter } from "./routes/privacy";
import { auditRequests } from "./middleware/audit";
import { sessionFilePath } from "./config/persistence";
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

const allowedOrigins = new Set([
    process.env.WEB_URL || "http://localhost:3000",
    "http://localhost:3000",
    "exp://localhost:8081",
    "http://localhost:8081",
    ...extraOrigins,
] as string[]);

app.disable("x-powered-by");
app.use(securityHeaders);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) callback(null, true);
    else callback(new Error("Origem CORS não autorizada"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  maxAge: 86400,
}));

app.use(express.json({ limit: "1mb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use((req, _res, next) => {
  const authorization = req.get("authorization");
  if (!req.headers.cookie && authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    if (isValidSignedSession(token, sessionSecret)) {
      req.headers.cookie = `fabi.sid=${encodeURIComponent(`s:${token}`)}`;
    }
  }
  next();
});
app.use(session({
  name: "fabi.sid",
  store: new EncryptedSessionStore(
    sessionFilePath(),
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
app.use(requireTrustedOrigin(allowedOrigins));
app.use(rateLimit({ prefix: "api", windowMs: 15 * 60_000, max: 300 }));
app.use(auditRequests);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "Raízes e Riquezas API" });
});

app.use("/auth", authRouter);
app.use("/chat", chatRouter);
app.use("/clients", clientsRouter);
app.use("/appointments", appointmentsRouter);
app.use("/privacy", privacyRouter);
app.use("/admin", adminRouter);
app.use("/booking", bookingRouter);
app.use("/public/booking", publicBookingRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: "JSON inválido" });
    return;
  }
  const httpError = error as { status?: number; message?: string };
  if (httpError.status === 413) {
    res.status(413).json({ error: "Conteúdo excede o limite permitido" });
    return;
  }
  if (httpError.message === "Origem CORS não autorizada") {
    res.status(403).json({ error: "Origem não autorizada" });
    return;
  }
  console.error("Erro não tratado:", error instanceof Error ? error.message : "erro desconhecido");
  res.status(500).json({ error: "Erro interno do servidor" });
});

getDb();

app.listen(port, () => {
  console.log(`Raízes e Riquezas API rodando na porta ${port}`);
});
