import { Router, type Request, type Router as ExpressRouter } from "express";
import { DateTime } from "luxon";
import { GoogleCalendarService } from "../services/google-calendar";
import { SyncedCalendarService } from "../services/synced-calendar";
import { requireGoogleCalendar, requireUser, sharedOwnerId, personalOwnerId } from "../middleware/auth";
import {
  ensureSettings,
  updateSettings,
  listCatalogSessionTypes,
  listBookingRequests,
  getBookingRequestById,
  markBookingRequest,
  countPendingRequests,
  type BookingRequestStatus,
} from "../services/booking-db";

const router: ExpressRouter = Router();
router.use(requireUser);

function userId(req: Request): string {
  return sharedOwnerId(req);
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
// Sourced from the catalog (Configurações → Produtos e serviços). Only
// active services with a defined duration appear as bookable types.

router.get("/types", (req, res) => {
  res.json(listCatalogSessionTypes(userId(req)));
});

// Types are now managed via the catalog (Configurações → Produtos e serviços).
// POST/PUT/DELETE /types return 410 Gone so clients notice the change.
router.post("/types", (_req, res) => {
  res.status(410).json({
    error:
      "Tipos de sessão agora vêm do catálogo. Cadastre em Configurações → Produtos e serviços (kind: serviço, com duração).",
  });
});
router.put("/types/:id", (_req, res) => {
  res.status(410).json({
    error: "Edite em Configurações → Produtos e serviços.",
  });
});
router.delete("/types/:id", (_req, res) => {
  res.status(410).json({
    error: "Exclua em Configurações → Produtos e serviços.",
  });
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
    // Appointment stored on the confirmer's personal calendar,
    // but client lookup uses the shared workspace.
    const calendar = new SyncedCalendarService(
      gcal,
      personalOwnerId(req),
      sharedOwnerId(req)
    );

    const title = `${request.session_type_name} — ${request.client_name}`;
    const description = [
      `Solicitado via página pública de agendamento.`,
      request.client_phone ? `Telefone: ${request.client_phone}` : "",
      request.client_notes ? `\nObservação do cliente:\n${request.client_notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const created = (await calendar.createEvent({
      title,
      startTime: request.requested_start,
      endTime: request.requested_end,
      description,
      appointmentType: "outro",
      clientName: request.client_name,
      clientEmail: request.client_email,
    })) as { id?: string };

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
