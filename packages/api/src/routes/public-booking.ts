import { Router, type Router as ExpressRouter } from "express";
import { DateTime } from "luxon";
import {
  getSettingsBySlug,
  getSettingsForUser,
  listCatalogSessionTypes,
  findCatalogSessionTypeBySlug,
  findCatalogSessionTypeById,
  createBookingRequest,
  listConflictingRequests,
  getBookingRequestByToken,
  markBookingRequest,
  type BookingSessionType,
  type BookingSettings,
} from "../services/booking-db";
import { GoogleCalendarService } from "../services/google-calendar";
import { getGoogleTokens, updateGoogleTokens } from "../services/google-tokens-db";
import {
  computeSlots,
  computeAvailableDays,
  validateSlotChoice,
  type Busy,
} from "../services/booking-availability";
import { rateLimit } from "../middleware/security";
import { getTenantConfig, getTenantDb } from "../services/database";
import { listTenants } from "../services/master-db";
import { tenantContext } from "../services/tenant-context";

const router: ExpressRouter = Router();

const publicLimiter = rateLimit({ prefix: "public-booking", windowMs: 60_000, max: 60 });
const submitLimiter = rateLimit({
  prefix: "public-booking-submit",
  windowMs: 60_000,
  max: 5,
});

function publicType(t: BookingSessionType) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    description: t.description,
    durationMinutes: t.duration_minutes,
    color: t.color,
  };
}

function publicPage(settings: BookingSettings) {
  const tenant = getTenantConfig(settings.user_id);
  return {
    slug: settings.slug,
    title: settings.title,
    intro: settings.intro,
    timezone: settings.timezone,
    maxAdvanceDays: settings.max_advance_days,
    minNoticeHours: settings.min_notice_hours,
    businessName: tenant?.business_name || settings.title,
    ownerName: tenant?.owner_name || "",
  };
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

router.use(publicLimiter);

// Resolve the tenant that owns the booking slug so getDb() hits the right database.
router.param("slug", (_req, _res, next, slug: string) => {
  for (const tenant of listTenants()) {
    try {
      const db = getTenantDb(tenant.slug);
      const row = db.prepare("SELECT user_id FROM booking_settings WHERE slug = ?").get(slug);
      if (row) {
        tenantContext.run({ tenantId: tenant.id, tenantSlug: tenant.slug }, () => next());
        return;
      }
    } catch { /* skip tenants whose DB isn't ready */ }
  }
  next();
});

router.param("token", (_req, _res, next, token: string) => {
  for (const tenant of listTenants()) {
    try {
      const db = getTenantDb(tenant.slug);
      const row = db.prepare("SELECT id FROM booking_requests WHERE manage_token = ?").get(token);
      if (row) {
        tenantContext.run({ tenantId: tenant.id, tenantSlug: tenant.slug }, () => next());
        return;
      }
    } catch { /* skip tenants whose DB isn't ready */ }
  }
  next();
});

// GET /public/booking/:slug — page metadata + active types
router.get("/:slug", (req, res) => {
  const settings = getSettingsBySlug(String(req.params.slug));
  if (!settings) {
    res.status(404).json({ error: "Página de agendamento não encontrada" });
    return;
  }
  const types = listCatalogSessionTypes(settings.user_id).map(publicType);
  res.json({ page: publicPage(settings), types });
});

// GET /public/booking/:slug/availability?type=slug&month=YYYY-MM
// or  /public/booking/:slug/availability?type=slug&date=YYYY-MM-DD
router.get("/:slug/availability", async (req, res) => {
  const settings = getSettingsBySlug(String(req.params.slug));
  if (!settings) {
    res.status(404).json({ error: "Página de agendamento não encontrada" });
    return;
  }
  const typeSlug = String(req.query.type || "");
  if (!typeSlug) {
    res.status(400).json({ error: "Tipo de sessão é obrigatório" });
    return;
  }
  const type = findCatalogSessionTypeBySlug(settings.user_id, typeSlug);
  if (!type) {
    res.status(404).json({ error: "Tipo de sessão não disponível" });
    return;
  }

  const now = DateTime.now().setZone(settings.timezone);
  const windowStart = now.startOf("day").toUTC().toISO()!;
  const maxWindow = now
    .plus({ days: settings.max_advance_days })
    .endOf("day")
    .toUTC()
    .toISO()!;

  // Busy from confirmed + pending booking requests
  const busyRows = listConflictingRequests(
    settings.user_id,
    windowStart,
    maxWindow
  );
  const busy: Busy[] = busyRows.map((b) => ({
    start: b.requested_start,
    end: b.requested_end,
  }));

  // Also fetch Google Calendar events so we don't offer slots already blocked
  const gcalTokens = getGoogleTokens(settings.user_id);
  if (gcalTokens) {
    try {
      const gcal = new GoogleCalendarService(gcalTokens, (refreshed) => {
        updateGoogleTokens(settings.user_id, refreshed);
      }, settings.timezone);
      const events = await gcal.listEvents(windowStart, maxWindow);
      for (const ev of events) {
        if (ev.start && ev.end) {
          busy.push({ start: ev.start, end: ev.end });
        }
      }
    } catch (err) {
      console.error("Falha ao consultar Google Calendar para disponibilidade:", err);
    }
  }

  const dateParam = req.query.date ? String(req.query.date) : null;
  const monthParam = req.query.month ? String(req.query.month) : null;

  if (dateParam) {
    const slots = computeSlots({
      date: dateParam,
      durationMinutes: type.duration_minutes,
      settings,
      busy,
      now,
    });
    res.json({ date: dateParam, slots });
    return;
  }

  const month = monthParam || now.toFormat("yyyy-LL");
  const busyByDay = new Map<string, Busy[]>();
  for (const b of busy) {
    const key = DateTime.fromISO(b.start, { zone: settings.timezone }).toFormat("yyyy-LL-dd");
    const list = busyByDay.get(key) ?? [];
    list.push(b);
    busyByDay.set(key, list);
  }
  const availableDays = computeAvailableDays({
    month,
    durationMinutes: type.duration_minutes,
    settings,
    busyByDay,
    now,
  });
  res.json({ month, availableDays });
});

// POST /public/booking/:slug/request
router.post("/:slug/request", submitLimiter, async (req, res) => {
  const settings = getSettingsBySlug(String(req.params.slug));
  if (!settings) {
    res.status(404).json({ error: "Página de agendamento não encontrada" });
    return;
  }

  const body = req.body as {
    typeSlug?: unknown;
    startISO?: unknown;
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    notes?: unknown;
  } | null;

  const typeSlug = typeof body?.typeSlug === "string" ? body.typeSlug : "";
  const startISO = typeof body?.startISO === "string" ? body.startISO : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

  if (!name || name.length < 2) {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }
  if (!email || !isEmail(email)) {
    res.status(400).json({ error: "E-mail inválido" });
    return;
  }
  if (notes.length > 2000) {
    res.status(400).json({ error: "Observação muito longa" });
    return;
  }

  const type = findCatalogSessionTypeBySlug(settings.user_id, typeSlug);
  if (!type) {
    res.status(400).json({ error: "Tipo de sessão inválido" });
    return;
  }

  const startDate = DateTime.fromISO(startISO, { zone: settings.timezone });
  if (!startDate.isValid) {
    res.status(400).json({ error: "Horário inválido" });
    return;
  }
  const endDate = startDate.plus({ minutes: type.duration_minutes });

  const dayStart = startDate.startOf("day").toUTC().toISO()!;
  const dayEnd = startDate.endOf("day").toUTC().toISO()!;

  const busyRows = listConflictingRequests(settings.user_id, dayStart, dayEnd);
  const busy: Busy[] = busyRows.map((b) => ({
    start: b.requested_start,
    end: b.requested_end,
  }));

  // Also check Google Calendar events
  const gcalTokens = getGoogleTokens(settings.user_id);
  if (gcalTokens) {
    try {
      const gcal = new GoogleCalendarService(gcalTokens, (refreshed) => {
        updateGoogleTokens(settings.user_id, refreshed);
      }, settings.timezone);
      const events = await gcal.listEvents(dayStart, dayEnd);
      for (const ev of events) {
        if (ev.start && ev.end) {
          busy.push({ start: ev.start, end: ev.end });
        }
      }
    } catch (err) {
      console.error("Falha ao consultar Google Calendar na submissão:", err);
    }
  }

  const check = validateSlotChoice({
    startISO,
    durationMinutes: type.duration_minutes,
    settings,
    busy,
  });
  if (!check.ok) {
    res.status(409).json({ error: check.error });
    return;
  }

  const request = createBookingRequest({
    userId: settings.user_id,
    sessionTypeId: type.id,
    sessionTypeName: type.name,
    clientName: name,
    clientEmail: email,
    clientPhone: phone || null,
    clientNotes: notes || null,
    requestedStart: startDate.toUTC().toISO()!,
    requestedEnd: endDate.toUTC().toISO()!,
  });

  res.status(201).json({
    id: request.id,
    manageToken: request.manage_token,
    status: request.status,
    requestedStart: request.requested_start,
    requestedEnd: request.requested_end,
    typeName: request.session_type_name,
  });
});

// GET /public/booking/manage/:token — client can view their request
router.get("/manage/:token", (req, res) => {
  const request = getBookingRequestByToken(String(req.params.token));
  if (!request) {
    res.status(404).json({ error: "Solicitação não encontrada" });
    return;
  }
  const settings = getSettingsForUser(request.user_id);
  res.json({
    id: request.id,
    status: request.status,
    typeName: request.session_type_name,
    requestedStart: request.requested_start,
    requestedEnd: request.requested_end,
    clientName: request.client_name,
    clientEmail: request.client_email,
    responded_reason: request.responded_reason,
    timezone: settings?.timezone ?? "America/Cuiaba",
  });
});

// POST /public/booking/manage/:token/cancel
router.post("/manage/:token/cancel", async (req, res) => {
  const request = getBookingRequestByToken(String(req.params.token));
  if (!request) {
    res.status(404).json({ error: "Solicitação não encontrada" });
    return;
  }
  if (request.status === "canceled" || request.status === "rejected") {
    res.status(400).json({ error: "Solicitação já finalizada" });
    return;
  }
  const hadGoogleEvent = request.status === "confirmed" && request.google_event_id;
  markBookingRequest(request.id, "canceled", { reason: "Cancelada pelo cliente" });

  if (hadGoogleEvent) {
    try {
      const tokens = getGoogleTokens(request.user_id);
      if (tokens) {
        const gcal = new GoogleCalendarService(tokens, (refreshed) => {
          updateGoogleTokens(request.user_id, refreshed);
        });
        await gcal.deleteEvent(request.google_event_id!);
      }
    } catch (err) {
      console.error("Falha ao remover evento do Google Calendar:", err);
    }
  }

  res.json({ ok: true });
});

export { router as publicBookingRouter };

// Utility export used by admin routes: current session type look-up.
export function _internalGetType(userId: string, id: string) {
  return findCatalogSessionTypeById(userId, id);
}
