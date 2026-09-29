import { Router, type Router as ExpressRouter } from "express";
import { requireUser, requireRole } from "../middleware/auth";
import {
  listUsers,
  createUser,
  updateUser,
  updatePassword,
  getUserById,
  getUserByEmail,
  type UserRole,
} from "../services/users-db";
import "../session-types";

const router: ExpressRouter = Router();
router.use(requireUser);
router.use(requireRole("admin"));

const VALID_ROLES: UserRole[] = ["admin", "gestor", "colaborador", "visualizador"];

router.get("/", (_req, res) => {
  res.json(listUsers());
});

router.get("/:id", (req, res) => {
  const user = getUserById(String(req.params.id));
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  const { password_hash: _, ...safe } = user;
  res.json(safe);
});

router.post("/", async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (!name || !email) {
    res.status(400).json({ error: "Nome e e-mail são obrigatórios" });
    return;
  }

  if (role && !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: `Perfil inválido. Use: ${VALID_ROLES.join(", ")}` });
    return;
  }

  const existing = getUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: "Já existe um usuário com este e-mail" });
    return;
  }

  try {
    const user = await createUser({
      name,
      email,
      password: password || undefined,
      role: role || "colaborador",
    });
    res.status(201).json(user);
  } catch (err) {
    console.error("Erro ao criar usuário:", err);
    res.status(500).json({ error: "Não foi possível criar o usuário" });
  }
});

router.put("/:id", (req, res) => {
  const id = String(req.params.id);
  const user = getUserById(id);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  const { name, email, role, active } = req.body || {};

  if (role && !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: `Perfil inválido. Use: ${VALID_ROLES.join(", ")}` });
    return;
  }

  if (email && email.toLowerCase() !== user.email.toLowerCase()) {
    const existing = getUserByEmail(email);
    if (existing && existing.id !== id) {
      res.status(409).json({ error: "Já existe um usuário com este e-mail" });
      return;
    }
  }

  const updated = updateUser(id, {
    name: name || undefined,
    email: email || undefined,
    role: role || undefined,
    active: active !== undefined ? (active ? 1 : 0) : undefined,
  });

  res.json(updated);
});

router.put("/:id/password", async (req, res) => {
  const id = String(req.params.id);
  const user = getUserById(id);
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  const { password } = req.body || {};
  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
    return;
  }

  try {
    await updatePassword(id, password);
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao atualizar senha:", err);
    res.status(500).json({ error: "Não foi possível atualizar a senha" });
  }
});

export { router as usersRouter };
