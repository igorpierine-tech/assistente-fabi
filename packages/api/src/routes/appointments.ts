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
import "../session-types";

const router: ExpressRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session.googleTokens && !req.session.googleUser) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

function calendarForSession(req: Request): GoogleCalendarService | null {
  if (!req.session.googleTokens) return null;
  return new GoogleCalendarService(req.session.googleTokens, (tokens) => {
    req.session.googleTokens = { ...req.session.googleTokens, ...tokens };
  });
}

router.get("/", requireAuth, (req, res) => {
  const { startDate, endDate, clientId, status } = req.query as Record<string, string>;
  const appointments = listAppointments({
    startDate, endDate, clientId, status,
  });
  res.json(appointments);
});

router.get("/:id", requireAuth, (req, res) => {
  const appointment = getAppointment(req.params.id);
  if (!appointment) {
    res.status(404).json({ error: "Agendamento não encontrado" });
    return;
  }
  res.json(appointment);
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, type, clientName, startTime, endTime, notes, status } = req.body;

    if (!title || !startTime || !endTime) {
      res.status(400).json({ error: "Título, horário de início e fim são obrigatórios" });
      return;
    }

    let clientId: string | undefined;
    if (clientName) {
      const client = getClientByName(clientName);
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

    const appointment = createAppointment({
      title, type, clientId, clientName, startTime, endTime, notes, googleEventId, status,
    });

    res.status(201).json(appointment);
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    res.status(500).json({ error: "Erro ao criar agendamento" });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const existing = getAppointment(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Agendamento não encontrado" });
      return;
    }

    const { title, type, clientName, startTime, endTime, notes, status } = req.body;

    let clientId: string | undefined;
    if (clientName) {
      const client = getClientByName(clientName);
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

    const updated = updateAppointment(req.params.id, {
      title, type, clientId, clientName, startTime, endTime, notes, status,
    });

    res.json(updated);
  } catch (error) {
    console.error("Erro ao atualizar agendamento:", error);
    res.status(500).json({ error: "Erro ao atualizar agendamento" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const existing = getAppointment(req.params.id);
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

    deleteAppointment(req.params.id);
    res.status(204).end();
  } catch (error) {
    console.error("Erro ao excluir agendamento:", error);
    res.status(500).json({ error: "Erro ao excluir agendamento" });
  }
});

export { router as appointmentsRouter };
