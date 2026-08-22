import { Router, type Request, type Router as ExpressRouter } from "express";
import {
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getClientByName,
} from "../services/database";
import { GoogleCalendarService } from "../services/google-calendar";
import { createReceivableFromAppointment } from "../services/receivables-db";
import { listCatalogItems } from "../services/catalog-db";
import "../session-types";
import { requireUser, sharedOwnerId } from "../middleware/auth";
import { optionalId, optionalString, requiredIsoDate, requiredString, ValidationError } from "../services/validation";

function findMatchingCatalogItem(userId: string, title: string) {
  if (!title) return null;
  const items = listCatalogItems(userId);
  const normalized = title.toLowerCase();
  // Try exact match on name
  const exact = items.find((i) => i.name.toLowerCase() === normalized);
  if (exact) return { id: exact.id, name: exact.name, price_cents: exact.price_cents };
  // Try substring match (title contains item name, or vice versa)
  const partial = items.find(
    (i) =>
      normalized.includes(i.name.toLowerCase()) ||
      i.name.toLowerCase().includes(normalized)
  );
  if (partial) return { id: partial.id, name: partial.name, price_cents: partial.price_cents };
  return null;
}

const router: ExpressRouter = Router();
router.use(requireUser);
router.param("id", (req, _res, next, value) => {
  optionalId(value, "ID do agendamento");
  next();
});
const VALID_STATUSES = new Set(["previsto", "confirmado", "em_andamento", "concluido", "cancelado"]);

function optionalStatus(value: unknown): string | undefined {
  const status = optionalString(value, "Status", 32);
  if (status && !VALID_STATUSES.has(status)) throw new ValidationError("Status inválido");
  return status;
}

function calendarForSession(req: Request): GoogleCalendarService | null {
  if (!req.session.googleTokens) return null;
  return new GoogleCalendarService(req.session.googleTokens, (tokens) => {
    req.session.googleTokens = { ...req.session.googleTokens, ...tokens };
  });
}

router.get("/", (req, res) => {
  const startDate = req.query.startDate === undefined ? undefined : requiredIsoDate(req.query.startDate, "Data inicial");
  const endDate = req.query.endDate === undefined ? undefined : requiredIsoDate(req.query.endDate, "Data final");
  const clientId = optionalId(req.query.clientId, "ID do cliente");
  const status = optionalStatus(req.query.status);
  const appointments = listAppointments(req.session.googleUser!.id, {
    startDate, endDate, clientId, status,
  });
  res.json(appointments);
});

router.get("/:id", (req, res) => {
  const appointment = getAppointment(req.session.googleUser!.id, req.params.id);
  if (!appointment) {
    res.status(404).json({ error: "Agendamento não encontrado" });
    return;
  }
  res.json(appointment);
});

router.post("/", async (req, res) => {
  try {
    const title = requiredString(req.body?.title, "Título", 200);
    const type = optionalString(req.body?.type, "Tipo", 64);
    const clientName = optionalString(req.body?.clientName, "Cliente", 160);
    const startTime = requiredIsoDate(req.body?.startTime, "Início");
    const endTime = requiredIsoDate(req.body?.endTime, "Fim");
    const notes = optionalString(req.body?.notes, "Observações", 10_000);
    const status = optionalStatus(req.body?.status);
    const userId = req.session.googleUser!.id;

    if (Date.parse(endTime) <= Date.parse(startTime)) throw new ValidationError("Fim deve ser posterior ao início");

    let clientId: string | undefined;
    if (clientName) {
      const client = getClientByName(sharedOwnerId(req), clientName);
      if (client) clientId = client.id;
    }

    let googleEventId: string | undefined;
    const calendar = calendarForSession(req);
    if (calendar) {
      const gcEvent = await calendar.createEvent({
        title,
        startTime,
        endTime,
        description: notes,
        appointmentType: type || "outro",
        clientName,
      });
      googleEventId = (gcEvent as any).id;
    }

    const appointment = createAppointment(userId, {
      title, type, clientId, clientName, startTime, endTime, notes, googleEventId, status,
    });

    res.status(201).json(appointment);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Erro ao criar agendamento:", error);
    res.status(500).json({ error: "Erro ao criar agendamento" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const userId = req.session.googleUser!.id;
    const existing = getAppointment(userId, req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Agendamento não encontrado" });
      return;
    }

    const title = optionalString(req.body?.title, "Título", 200);
    const type = optionalString(req.body?.type, "Tipo", 64);
    const clientName = optionalString(req.body?.clientName, "Cliente", 160);
    const startTime = req.body?.startTime === undefined ? undefined : requiredIsoDate(req.body.startTime, "Início");
    const endTime = req.body?.endTime === undefined ? undefined : requiredIsoDate(req.body.endTime, "Fim");
    const notes = optionalString(req.body?.notes, "Observações", 10_000);
    const status = optionalStatus(req.body?.status);
    if (Date.parse(endTime || existing.end_time) <= Date.parse(startTime || existing.start_time)) {
      throw new ValidationError("Fim deve ser posterior ao início");
    }

    let clientId: string | undefined;
    if (clientName) {
      const client = getClientByName(sharedOwnerId(req), clientName);
      if (client) clientId = client.id;
    }

    const calendar = calendarForSession(req);
    if (calendar && existing.google_event_id) {
      const updates: Record<string, unknown> = {};
      if (title) updates.title = title;
      if (startTime) updates.startTime = startTime;
      if (endTime) updates.endTime = endTime;
      if (notes !== undefined) updates.description = notes;
      if (Object.keys(updates).length > 0) {
        await calendar.updateEvent(existing.google_event_id, updates);
      }
    }

    const updated = updateAppointment(userId, req.params.id, {
      title, type, clientId, clientName, startTime, endTime, notes, status,
    });

    // Auto-create receivable when appointment transitions to "concluido"
    if (
      updated &&
      status === "concluido" &&
      existing.status !== "concluido"
    ) {
      try {
        const shared = sharedOwnerId(req);
        const matched = findMatchingCatalogItem(shared, updated.title);
        createReceivableFromAppointment(
          shared,
          {
            id: updated.id,
            title: updated.title,
            client_id: updated.client_id,
            client_name: updated.client_name,
            start_time: updated.start_time,
          },
          matched
        );
      } catch (err) {
        console.warn("Falha ao criar contas a receber:", err);
      }
    }

    res.json(updated);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Erro ao atualizar agendamento:", error);
    res.status(500).json({ error: "Erro ao atualizar agendamento" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const userId = req.session.googleUser!.id;
    const existing = getAppointment(userId, req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Agendamento não encontrado" });
      return;
    }

    const calendar = calendarForSession(req);
    if (calendar && existing.google_event_id) {
      try {
        await calendar.deleteEvent(existing.google_event_id);
      } catch (err) {
        console.warn("Falha ao remover evento do Google Calendar:", err);
      }
    }

    deleteAppointment(userId, req.params.id);
    res.status(204).end();
  } catch (error) {
    console.error("Erro ao excluir agendamento:", error);
    res.status(500).json({ error: "Erro ao excluir agendamento" });
  }
});

export { router as appointmentsRouter };
