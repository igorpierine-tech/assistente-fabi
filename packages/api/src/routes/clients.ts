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
import { requireUser } from "../middleware/auth";
import { optionalEmail, optionalId, optionalString, requiredString } from "../services/validation";

const router: ExpressRouter = Router();
router.use(requireUser);
router.param("id", (req, _res, next, value) => {
  optionalId(value, "ID do cliente");
  next();
});

router.get("/", (req, res) => {
  const userId = req.session.googleUser!.id;
  const search = optionalString(req.query.search, "Busca", 100);
  const clients = listClients(userId, search);
  res.json(clients);
});

router.get("/:id", (req, res) => {
  const client = getClient(req.session.googleUser!.id, req.params.id);
  if (!client) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  res.json(client);
});

router.post("/", (req, res) => {
  const name = requiredString(req.body?.name, "Nome", 160);
  const phone = optionalString(req.body?.phone, "Telefone", 32);
  const email = optionalEmail(req.body?.email);
  const notes = optionalString(req.body?.notes, "Prontuário", 10_000);
  const client = createClient(req.session.googleUser!.id, { name, phone, email, notes });
  res.status(201).json(client);
});

router.put("/:id", (req, res) => {
  const userId = req.session.googleUser!.id;
  const existing = getClient(userId, req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  const name = optionalString(req.body?.name, "Nome", 160);
  const phone = optionalString(req.body?.phone, "Telefone", 32);
  const email = optionalEmail(req.body?.email);
  const notes = optionalString(req.body?.notes, "Prontuário", 10_000);
  const updated = updateClient(userId, req.params.id, { name, phone, email, notes });
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  const deleted = deleteClient(req.session.googleUser!.id, req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  res.status(204).end();
});

router.get("/:id/appointments", (req, res) => {
  const userId = req.session.googleUser!.id;
  const client = getClient(userId, req.params.id);
  if (!client) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  const appointments = getClientAppointments(userId, req.params.id);
  res.json(appointments);
});

export { router as clientsRouter };
