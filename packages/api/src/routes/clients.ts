import { Router, type Router as ExpressRouter } from "express";
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getClientAppointments,
} from "../services/database";
import "../session-types";

const router: ExpressRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session.googleTokens && !req.session.googleUser) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

router.get("/", requireAuth, (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const clients = listClients(search);
  res.json(clients);
});

router.get("/:id", requireAuth, (req, res) => {
  const client = getClient(req.params.id);
  if (!client) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  res.json(client);
});

router.post("/", requireAuth, (req, res) => {
  const { name, phone, email, notes } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }
  const client = createClient({ name: name.trim(), phone, email, notes });
  res.status(201).json(client);
});

router.put("/:id", requireAuth, (req, res) => {
  const existing = getClient(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  const { name, phone, email, notes } = req.body;
  const updated = updateClient(req.params.id, { name, phone, email, notes });
  res.json(updated);
});

router.delete("/:id", requireAuth, (req, res) => {
  const deleted = deleteClient(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  res.status(204).end();
});

router.get("/:id/appointments", requireAuth, (req, res) => {
  const client = getClient(req.params.id);
  if (!client) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  const appointments = getClientAppointments(req.params.id);
  res.json(appointments);
});

export { router as clientsRouter };
