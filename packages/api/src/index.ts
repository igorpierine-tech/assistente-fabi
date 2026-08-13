import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { chatRouter } from "./routes/chat";

const app = express();
const port = parseInt(process.env.API_PORT || "3001", 10);

app.use(cors({
  origin: [
    process.env.WEB_URL || "http://localhost:3000",
    "exp://localhost:8081",
  ],
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "Assistente da Fabi API" });
});

app.use("/auth", authRouter);
app.use("/chat", chatRouter);

app.listen(port, () => {
  console.log(`Assistente da Fabi API rodando na porta ${port}`);
});
