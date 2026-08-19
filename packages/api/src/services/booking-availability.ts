import { DateTime, Interval } from "luxon";
import type { BookingSettings, WorkHours } from "./booking-db";

export interface Busy {
  start: string; // ISO
  end: string; // ISO
}

export interface Slot {
  start: string; // ISO
  end: string; // ISO
}

/**
 * Compute available start times for a given day, in the settings' timezone,
 * respecting work hours, buffer, min notice, and existing busy intervals.
 */
export function computeSlots(params: {
  date: string; // YYYY-MM-DD in settings timezone
  durationMinutes: number;
  settings: BookingSettings;
  busy: Busy[];
  stepMinutes?: number; // default 30
  now?: DateTime;
}): Slot[] {
  const { date, durationMinutes, settings, busy } = params;
  const tz = settings.timezone || "America/Cuiaba";
  const step = params.stepMinutes ?? 30;
  const day = DateTime.fromISO(date, { zone: tz });
  if (!day.isValid) return [];

  const weekday = day.weekday % 7; // Luxon: Mon=1..Sun=7 -> map to 0(Sun)-6(Sat)
  const dayKey = String(weekday);
  const ranges = settings.work_hours?.[dayKey] ?? [];
  if (ranges.length === 0) return [];

  const now = params.now ?? DateTime.now().setZone(tz);
  const earliestBookable = now.plus({ hours: settings.min_notice_hours });
  const buffer = settings.buffer_minutes ?? 0;

  const busyIntervals = busy
    .map((b) => {
      const start = DateTime.fromISO(b.start, { zone: tz });
      const end = DateTime.fromISO(b.end, { zone: tz });
      if (!start.isValid || !end.isValid) return null;
      // Extend busy with buffer on both sides so slots don't butt up against events
      return Interval.fromDateTimes(
        start.minus({ minutes: buffer }),
        end.plus({ minutes: buffer })
      );
    })
    .filter((i): i is Interval => i !== null && i.isValid);

  const slots: Slot[] = [];

  for (const [startStr, endStr] of ranges) {
    const rangeStart = parseTimeOnDay(day, startStr, tz);
    const rangeEnd = parseTimeOnDay(day, endStr, tz);
    if (!rangeStart || !rangeEnd) continue;

    let cursor = rangeStart;
    while (cursor.plus({ minutes: durationMinutes }) <= rangeEnd) {
      const slotEnd = cursor.plus({ minutes: durationMinutes });
      const slotInterval = Interval.fromDateTimes(cursor, slotEnd);

      const overlaps = busyIntervals.some((busy) =>
        busy.overlaps(slotInterval)
      );

      if (!overlaps && cursor >= earliestBookable) {
        slots.push({
          start: cursor.toUTC().toISO()!,
          end: slotEnd.toUTC().toISO()!,
        });
      }

      cursor = cursor.plus({ minutes: step });
    }
  }

  return slots;
}

function parseTimeOnDay(day: DateTime, timeStr: string, tz: string): DateTime | null {
  const [h, m] = timeStr.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return day.setZone(tz).set({ hour: h, minute: m, second: 0, millisecond: 0 });
}

export function validateSlotChoice(params: {
  startISO: string;
  durationMinutes: number;
  settings: BookingSettings;
  busy: Busy[];
  now?: DateTime;
}): { ok: true } | { ok: false; error: string } {
  const tz = params.settings.timezone || "America/Cuiaba";
  const start = DateTime.fromISO(params.startISO, { zone: tz });
  if (!start.isValid) return { ok: false, error: "Data inválida" };
  const now = params.now ?? DateTime.now().setZone(tz);
  if (start < now.plus({ hours: params.settings.min_notice_hours })) {
    return { ok: false, error: "Horário muito próximo do agora" };
  }
  if (start > now.plus({ days: params.settings.max_advance_days })) {
    return { ok: false, error: "Horário muito distante" };
  }

  const date = start.toFormat("yyyy-LL-dd");
  const slots = computeSlots({
    date,
    durationMinutes: params.durationMinutes,
    settings: params.settings,
    busy: params.busy,
    now,
  });

  const startUtc = start.toUTC().toISO();
  const exists = slots.some((slot) => slot.start === startUtc);
  return exists ? { ok: true } : { ok: false, error: "Horário não disponível" };
}

/**
 * Given month YYYY-MM, return which days have at least one slot.
 * Used to grey-out unavailable days on the calendar.
 */
export function computeAvailableDays(params: {
  month: string; // YYYY-MM
  durationMinutes: number;
  settings: BookingSettings;
  busyByDay: Map<string, Busy[]>;
  now?: DateTime;
}): string[] {
  const tz = params.settings.timezone || "America/Cuiaba";
  const first = DateTime.fromISO(`${params.month}-01`, { zone: tz });
  if (!first.isValid) return [];
  const daysInMonth = first.daysInMonth || 30;
  const available: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const day = first.set({ day: d });
    const key = day.toFormat("yyyy-LL-dd");
    const slots = computeSlots({
      date: key,
      durationMinutes: params.durationMinutes,
      settings: params.settings,
      busy: params.busyByDay.get(key) ?? [],
      now: params.now,
    });
    if (slots.length > 0) available.push(key);
  }
  return available;
}
