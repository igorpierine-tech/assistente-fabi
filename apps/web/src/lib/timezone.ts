/**
 * Timezone helpers. All appointment times are anchored to America/Cuiaba
 * (Fabi's practice location) regardless of the browser's local timezone.
 * This keeps schedules consistent whether Fabi logs in from Cuiabá, a laptop
 * on São Paulo time, a phone abroad, or a browser stuck on UTC.
 */

export const APP_TIMEZONE = "America/Cuiaba";

/**
 * Format the offset in minutes for a given instant in a given timezone.
 * Uses Intl.DateTimeFormat because JS has no first-class TZ arithmetic.
 * Returns the offset in MINUTES that you subtract from the local wall-clock
 * time to get UTC (e.g. Cuiabá returns -240 = 4 h behind UTC).
 */
function tzOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date).reduce<Record<string, string>>(
    (acc, p) => {
      acc[p.type] = p.value;
      return acc;
    },
    {}
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? 0 : parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return (asUtc - date.getTime()) / 60000;
}

/**
 * Convert a datetime-local input string (e.g. "2026-08-21T07:00")
 * interpreted as Cuiabá local time into a UTC ISO string.
 */
export function localInputToIso(input: string): string {
  if (!input) return "";
  const [d, t] = input.split("T");
  if (!d || !t) return "";
  const [y, mo, day] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  if ([y, mo, day, h, mi].some((n) => Number.isNaN(n))) return "";
  // First guess: pretend it's UTC and compute the local-tz offset for that
  // instant. Then subtract that offset to get the correct UTC time.
  const guess = new Date(Date.UTC(y, mo - 1, day, h, mi));
  const offsetMin = tzOffsetMinutes(guess, APP_TIMEZONE);
  return new Date(guess.getTime() - offsetMin * 60000).toISOString();
}

/**
 * Convert a UTC ISO string into a "YYYY-MM-DDTHH:mm" string in Cuiabá time,
 * suitable for populating a datetime-local input.
 */
export function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/** Format an ISO string as HH:mm in Cuiabá time. */
export function formatTimeCuiaba(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  });
}

/** Format an ISO string as a long date in Cuiabá time (pt-BR). */
export function formatDateCuiaba(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: APP_TIMEZONE,
  });
}
