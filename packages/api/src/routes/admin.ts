import { timingSafeEqual } from "node:crypto";
import { Router, type Router as ExpressRouter } from "express";
import { getDb } from "../services/database";
import { getUserByEmail, updatePassword } from "../services/users-db";

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

function listUsersWithPasswordStatus() {
  return getDb()
    .prepare("SELECT id, name, email, role, CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END as has_password FROM users ORDER BY name")
    .all() as { id: string; name: string; email: string; role: string; has_password: number }[];
}

// GET /admin — admin tools page
router.get("/", (_req, res) => {
  const users = listUsersWithPasswordStatus();
  const userOptions = users.map((u) =>
    `<option value="${u.email}">${u.name} (${u.email}) — ${u.role}${u.has_password ? "" : " [SEM SENHA]"}</option>`
  ).join("");

  res.type("html").send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Admin — Assistente de Agenda</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#12160f;color:#f4ede0;
       display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;margin:0;
       flex-direction:column;gap:24px}
  form,.card{background:rgba(253,250,243,.04);border:1px solid rgba(217,178,104,.2);
       padding:32px;border-radius:16px;max-width:420px;width:100%}
  h1{font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 8px}
  h2{font-family:Georgia,serif;font-weight:400;font-size:22px;margin:0 0 8px}
  p{color:#c8bfae;font-size:14px;line-height:1.5;margin:0 0 20px}
  label{display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;
        color:#8a7f6a;margin-bottom:8px;margin-top:12px}
  input,select{width:100%;padding:12px 14px;border-radius:10px;background:#1a2e18;
        border:1px solid rgba(217,178,104,.2);color:#f4ede0;font-size:15px;
        font-family:inherit;box-sizing:border-box}
  button{margin-top:16px;width:100%;padding:14px;border:none;border-radius:10px;
         font-weight:600;font-size:15px;cursor:pointer;font-family:inherit;color:#fff}
  .btn-primary{background:#2d6a30}
  .btn-primary:hover{background:#3a8a3e}
  .btn-danger{background:#c04a2a}
  .btn-danger:hover{background:#d15a3a}
  .warn{color:#d9b268;font-size:12px;margin-top:12px;text-align:center}
  .info{color:#6aaa6e;font-size:12px;margin-top:12px;text-align:center}
</style></head><body>
<form method="post" action="/admin/set-password">
  <h2>Definir senha de usuário</h2>
  <p>Define ou redefine a senha de um usuário existente.</p>
  <label for="sp-token">Token de admin</label>
  <input id="sp-token" name="token" type="password" autocomplete="off" required>
  <label for="sp-email">E-mail do usuário</label>
  <select id="sp-email" name="email">${userOptions || '<option value="">Nenhum usuário</option>'}</select>
  <label for="sp-password">Nova senha (mín. 6 caracteres)</label>
  <input id="sp-password" name="password" type="password" minlength="6" required>
  <button type="submit" class="btn-primary">Definir senha</button>
  <div class="info">Permite login por e-mail/senha</div>
</form>

<form method="post" action="/admin/reset" onsubmit="return confirm('Apagar TODOS os clientes, agendamentos e conversas? Essa ação não pode ser desfeita.')">
  <h2>Resetar base de dados</h2>
  <p>Apaga <strong>clientes, agendamentos, conversas e mensagens</strong>. Sessões e login continuam.</p>
  <label for="token">Token de admin</label>
  <input id="token" name="token" type="password" autocomplete="off" required>
  <button type="submit" class="btn-danger">Apagar todos os dados</button>
  <div class="warn">Ação irreversível</div>
</form>
</body></html>`);
});

router.post("/set-password", async (req, res) => {
  const expected = getAdminToken();
  if (!expected) {
    res.status(501).json({ error: "ADMIN_TOKEN não configurado no servidor." });
    return;
  }

  const provided = pickToken(req);
  if (!tokenMatches(provided, expected)) {
    res.status(401).json({ error: "Token inválido" });
    return;
  }

  const email = (req.body as { email?: string })?.email;
  const password = (req.body as { password?: string })?.password;

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "E-mail é obrigatório" });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
    return;
  }

  const user = getUserByEmail(email);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  try {
    await updatePassword(user.id, password);

    if (req.accepts(["html", "json"]) === "html") {
      res.type("html").send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Senha definida</title>
<style>
  body{font-family:system-ui,sans-serif;background:#12160f;color:#f4ede0;
       display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;margin:0}
  .box{background:rgba(253,250,243,.04);border:1px solid rgba(217,178,104,.2);
       padding:32px;border-radius:16px;max-width:420px;text-align:center}
  h1{font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 12px;color:#6aaa6e}
  p{color:#c8bfae;font-size:14px}
  a{color:#d9b268}
</style></head><body>
<div class="box">
  <h1>Senha definida</h1>
  <p>A senha de <strong>${user.name}</strong> (${user.email}) foi atualizada.</p>
  <p style="margin-top:16px"><a href="/admin">Voltar</a></p>
</div>
</body></html>`);
    } else {
      res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
    }
  } catch (error) {
    console.error("Erro ao definir senha:", error);
    res.status(500).json({ error: "Falha ao definir senha" });
  }
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
