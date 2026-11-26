import "dotenv/config";
import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { securityHeaders, rateLimit } from "./middleware/security";
import { authRouter } from "./routes/auth.routes";
import { tenantRouter } from "./routes/tenant.routes";
import { programRouter } from "./routes/program.routes";
import { moduleRouter } from "./routes/module.routes";
import { lessonRouter } from "./routes/lesson.routes";
import { assessmentRouter } from "./routes/assessment.routes";
import { gamificationRouter } from "./routes/gamification.routes";
import { billingRouter } from "./routes/billing.routes";
import { AppError } from "./services/auth.service";
import "./types/express";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

// ─── Global middleware ───────────────────────────────────────────────────────

app.use(securityHeaders);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === env.webUrl || !env.isProduction) {
        callback(null, true);
      } else {
        callback(new Error("Origem CORS não autorizada"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 86400,
  })
);

app.use("/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use(rateLimit({ windowMs: 15 * 60_000, max: 300, prefix: "global" }));

// ─── Health check ────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "LMS Líder Áurea API" });
});

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use("/auth", authRouter);
app.use("/tenant", tenantRouter);
app.use("/programs", programRouter);
app.use("/programs/:programId/modules", moduleRouter);
app.use("/lessons", lessonRouter);
app.use("/assessments", assessmentRouter);
app.use("/gamification", gamificationRouter);
app.use("/billing", billingRouter);

// ─── 404 ─────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

// ─── Error handler ───────────────────────────────────────────────────────────

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: "JSON inválido." });
      return;
    }
    const httpError = err as { status?: number; message?: string };
    if (httpError.message === "Origem CORS não autorizada") {
      res.status(403).json({ error: "Origem não autorizada." });
      return;
    }
    console.error("[LMS API] Erro não tratado:", err instanceof Error ? err.message : "unknown");
    res.status(500).json({ error: "Erro interno do servidor." });
  }
);

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(env.port, () => {
  console.log(`LMS Líder Áurea API rodando na porta ${env.port}`);
});
