import { timingSafeEqual } from "node:crypto";
import { Router, type Router as ExpressRouter } from "express";
import { getDb } from "../services/database";

const router: ExpressRouter = Router();

function tokenMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function getAdminToken(): string | null {
  const token = process.env.ADMIN_TOKEN;
  if (!token || token.length < 16) return null;
  return token;
}

function pickToken(req: import("express").Request): string | undefined {
  const header = req.get("x-admin-token");
  if (header) return header;
  const body = (req.body as { token?: unknown } | undefined)?.token;
  if (typeof body === "string") return body;
  return undefined;
}

// GET /admin — small HTML page for the admin to trigger reset from a browser
router.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Admin — Raízes e Riquezas</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#12160f;color:#f4ede0;
       display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;margin:0}
  form{background:rgba(253,250,243,.04);border:1px solid rgba(217,178,104,.2);
       padding:32px;border-radius:16px;max-width:420px;width:100%}
  h1{font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 8px}
  p{color:#c8bfae;font-size:14px;line-height:1.5;margin:0 0 20px}
  label{display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;
        color:#8a7f6a;margin-bottom:8px}
  input{width:100%;padding:12px 14px;border-radius:10px;background:#1a2e18;
        border:1px solid rgba(217,178,104,.2);color:#f4ede0;font-size:15px;
        font-family:inherit;box-sizing:border-box}
  button{margin-top:16px;width:100%;padding:14px;border:none;border-radius:10px;
         background:#c04a2a;color:#fff;font-weight:600;font-size:15px;cursor:pointer;
         font-family:inherit}
  button:hover{background:#d15a3a}
  .warn{color:#d9b268;font-size:12px;margin-top:12px;text-align:center}
</style></head><body>
<form method="post" action="/admin/reset" onsubmit="return confirm('Apagar TODOS os clientes, agendamentos e conversas? Essa ação não pode ser desfeita.')">
  <h1>Resetar base de dados</h1>
  <p>Apaga <strong>clientes, agendamentos, conversas e mensagens</strong>. Sessões e login continuam.</p>
  <label for="token">Token de admin</label>
  <input id="token" name="token" type="password" autocomplete="off" required>
  <button type="submit">Apagar todos os dados</button>
  <div class="warn">Ação irreversível</div>
</form>
</body></html>`);
});

router.post("/reset", (req, res) => {
  const expected = getAdminToken();
  if (!expected) {
    res.status(501).json({
      error:
        "ADMIN_TOKEN não configurado no servidor. Defina a variável de ambiente para usar este endpoint.",
    });
    return;
  }

  const provided = pickToken(req);
  if (!tokenMatches(provided, expected)) {
    res.status(401).json({ error: "Token inválido" });
    return;
  }

  try {
    const db = getDb();
    const counts = {
      messages: 0,
      conversations: 0,
      appointments: 0,
      clients: 0,
    };
    db.transaction(() => {
      counts.messages = db.prepare("DELETE FROM messages").run().changes;
      counts.conversations = db.prepare("DELETE FROM conversations").run().changes;
      counts.appointments = db.prepare("DELETE FROM appointments").run().changes;
      counts.clients = db.prepare("DELETE FROM clients").run().changes;
    })();

    if (req.accepts(["html", "json"]) === "html") {
      res.type("html").send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Reset OK</title>
<style>
  body{font-family:system-ui,sans-serif;background:#12160f;color:#f4ede0;
       display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;margin:0}
  .box{background:rgba(253,250,243,.04);border:1px solid rgba(217,178,104,.2);
       padding:32px;border-radius:16px;max-width:420px;text-align:center}
  h1{font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 12px;color:#d9b268}
  ul{list-style:none;padding:0;margin:16px 0;color:#c8bfae;font-size:14px}
  li{padding:6px 0;border-bottom:1px solid rgba(217,178,104,.1)}
  a{color:#d9b268}
</style></head><body>
<div class="box">
  <h1>✓ Base de dados limpa</h1>
  <ul>
    <li>${counts.clients} clientes removidos</li>
    <li>${counts.appointments} agendamentos removidos</li>
    <li>${counts.conversations} conversas removidas</li>
    <li>${counts.messages} mensagens removidas</li>
  </ul>
  <p><a href="${process.env.WEB_URL || "/"}">Voltar ao app</a></p>
</div>
</body></html>`);
    } else {
      res.json({ ok: true, removed: counts });
    }
  } catch (error) {
    console.error("Reset admin falhou:", error);
    res.status(500).json({ error: "Falha ao resetar" });
  }
});

export { router as adminRouter };
