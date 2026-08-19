import { Router, type Request, type Router as ExpressRouter } from "express";
import { DateTime } from "luxon";
import { GoogleCalendarService } from "../services/google-calendar";
import { requireGoogleCalendar, requireUser } from "../middleware/auth";
import {
  ensureSettings,
  updateSettings,
  listSessionTypes,
  createSessionType,
  updateSessionType,
  deleteSessionType,
  getSessionTypeBySlug,
  listBookingRequests,
  getBookingRequestById,
  markBookingRequest,
  countPendingRequests,
  type BookingRequestStatus,
} from "../services/booking-db";

const router: ExpressRouter = Router();
router.use(requireUser);

function userId(req: Request): string {
  return req.session.googleUser!.id;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// --- Settings ---

router.get("/settings", (req, res) => {
  const settings = ensureSettings(userId(req));
  res.json(settings);
});

router.put("/settings", (req, res) => {
  const b = req.body as Partial<{
    slug: string;
    title: string;
    intro: string;
    timezone: string;
    work_hours: Record<string, [string, string][]>;
    buffer_minutes: number;
    max_advance_days: number;
    min_notice_hours: number;
  }> | null;
  if (!b) {
    res.status(400).json({ error: "Body inválido" });
    return;
  }
  if (b.slug) {
    b.slug = slugify(b.slug);
    if (b.slug.length < 3) {
      res.status(400).json({ error: "Slug muito curto" });
      return;
    }
  }
  try {
    const settings = updateSettings(userId(req), b);
    res.json(settings);
  } catch (error) {
    if ((error as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
      res.status(409).json({ error: "Este endereço da página já está em uso" });
      return;
    }
    console.error("Erro ao atualizar booking settings:", error);
    res.status(500).json({ error: "Falha ao salvar" });
  }
});

// --- Session types ---

router.get("/types", (req, res) => {
  res.json(listSessionTypes(userId(req), false));
});

router.post("/types", (req, res) => {
  const b = req.body as {
    name?: string;
    description?: string;
    durationMinutes?: number;
    color?: string;
    active?: boolean;
    slug?: string;
  } | null;
  if (!b || !b.name || !b.durationMinutes) {
    res.status(400).json({ error: "Nome e duração são obrigatórios" });
    return;
  }
  const slug = slugify(b.slug || b.name);
  if (!slug) {
    res.status(400).json({ error: "Slug inválido" });
    return;
  }
  const existing = getSessionTypeBySlug(userId(req), slug);
  if (existing) {
    res.status(409).json({ error: "Já existe um tipo com esse slug" });
    return;
  }
  const type = createSessionType(userId(req), {
    slug,
    name: b.name,
    description: b.description ?? null,
    duration_minutes: Math.max(15, Math.min(600, Math.round(b.durationMinutes))),
    color: b.color ?? null,
    active: b.active === false ? 0 : 1,
  });
  res.status(201).json(type);
});

router.put("/types/:id", (req, res) => {
  const b = req.body as {
    name?: string;
    description?: string;
    durationMinutes?: number;
    color?: string;
    active?: boolean;
    slug?: string;
    sort_order?: number;
  } | null;
  if (!b) {
    res.status(400).json({ error: "Body inválido" });
    return;
  }
  const patch: Parameters<typeof updateSessionType>[2] = {};
  if (b.name !== undefined) patch.name = b.name;
  if (b.description !== undefined) patch.description = b.description;
  if (b.durationMinutes !== undefined)
    patch.duration_minutes = Math.max(15, Math.min(600, Math.round(b.durationMinutes)));
  if (b.color !== undefined) patch.color = b.color;
  if (b.active !== undefined) patch.active = b.active ? 1 : 0;
  if (b.slug !== undefined) patch.slug = slugify(b.slug);
  if (b.sort_order !== undefined) patch.sort_order = b.sort_order;
  const updated = updateSessionType(userId(req), String(req.params.id), patch);
  if (!updated) {
    res.status(404).json({ error: "Tipo não encontrado" });
    return;
  }
  res.json(updated);
});

router.delete("/types/:id", (req, res) => {
  const ok = deleteSessionType(userId(req), String(req.params.id));
  if (!ok) {
    res.status(404).json({ error: "Tipo não encontrado" });
    return;
  }
  res.status(204).end();
});

// --- Requests ---

router.get("/requests", (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const allowed: BookingRequestStatus[] = ["pending", "confirmed", "rejected", "canceled"];
  const filter = allowed.includes(status as BookingRequestStatus)
    ? (status as BookingRequestStatus)
    : undefined;
  res.json(listBookingRequests(userId(req), filter));
});

router.get("/requests/pending-count", (req, res) => {
  res.json({ count: countPendingRequests(userId(req)) });
});

router.post("/requests/:id/confirm", requireGoogleCalendar, async (req, res) => {
  const request = getBookingRequestById(String(req.params.id));
  if (!request || request.user_id !== userId(req)) {
    res.status(404).json({ error: "Solicitação não encontrada" });
    return;
  }
  if (request.status !== "pending") {
    res.status(400).json({ error: `Solicitação já está ${request.status}` });
    return;
  }

  try {
    const gcal = new GoogleCalendarService(
      req.session.googleTokens!,
      (tokens) => {
        req.session.googleTokens = { ...req.session.googleTokens, ...tokens };
      }
    );

    const title = `${request.session_type_name} — ${request.client_name}`;
    const description = [
      `Solicitado via página pública de agendamento.`,
      request.client_phone ? `Telefone: ${request.client_phone}` : "",
      request.client_notes ? `\nObservação do cliente:\n${request.client_notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const created = await gcal.createEvent({
      title,
      startTime: request.requested_start,
      endTime: request.requested_end,
      description,
      appointmentType: "outro",
      clientName: request.client_name,
      clientEmail: request.client_email,
    });

    markBookingRequest(request.id, "confirmed", {
      googleEventId: created.id ?? null,
    });
    res.json({ ok: true, googleEventId: created.id });
  } catch (error) {
    console.error("Falha ao confirmar booking:", error);
    res.status(500).json({ error: "Não foi possível criar o evento no Google Calendar" });
  }
});

router.post("/requests/:id/reject", (req, res) => {
  const request = getBookingRequestById(String(req.params.id));
  if (!request || request.user_id !== userId(req)) {
    res.status(404).json({ error: "Solicitação não encontrada" });
    return;
  }
  if (request.status !== "pending") {
    res.status(400).json({ error: `Solicitação já está ${request.status}` });
    return;
  }
  const reason =
    typeof req.body?.reason === "string" ? String(req.body.reason).slice(0, 500) : null;
  markBookingRequest(request.id, "rejected", { reason });
  res.json({ ok: true });
});

// Fabi's own view of the public URL
router.get("/public-url", (req, res) => {
  const settings = ensureSettings(userId(req));
  const webUrl = process.env.WEB_URL || "http://localhost:3000";
  res.json({
    slug: settings.slug,
    url: `${webUrl.replace(/\/$/, "")}/agendar/${settings.slug}`,
  });
});

export { router as bookingRouter };
