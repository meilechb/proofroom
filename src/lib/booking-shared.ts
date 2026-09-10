/**
 * Client-safe booking types and slot math (plan 3.89, 21.9-21.11). Kept out of
 * booking.ts so the settings form, the tenant /book page and tests can use them
 * without the server-only database functions.
 */

export type WeeklyHours = Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", { start: string; end: string }[]>; // "HH:MM" in studio tz, 0 = Sunday

export type BookingSettings = {
  enabled: boolean;
  weekly: WeeklyHours;
  bufferMinutes: number;
  leadTimeHours: number;
  maxPerDay: number;
  slotStepMinutes: number;
  depositRequired: boolean;
  policy: string;
  blockedDates: string[]; // "YYYY-MM-DD"
};

export const DEFAULT_BOOKING: BookingSettings = {
  enabled: false,
  weekly: { "0": [], "1": [{ start: "09:00", end: "17:00" }], "2": [{ start: "09:00", end: "17:00" }], "3": [{ start: "09:00", end: "17:00" }], "4": [{ start: "09:00", end: "17:00" }], "5": [{ start: "09:00", end: "15:00" }], "6": [] },
  bufferMinutes: 15,
  leadTimeHours: 24,
  maxPerDay: 6,
  slotStepMinutes: 30,
  depositRequired: true,
  policy: "Reschedule or cancel up to 48 hours before the session at no charge.",
  blockedDates: [],
};

export function bookingSettings(settings: Record<string, unknown> | null | undefined): BookingSettings {
  const raw = (settings?.booking ?? {}) as Partial<BookingSettings>;
  return { ...DEFAULT_BOOKING, ...raw, weekly: { ...DEFAULT_BOOKING.weekly, ...(raw.weekly ?? {}) } };
}

export const HOLD_MINUTES = 15;

/** Session length used when a package has no explicit duration set. */
export const DEFAULT_SESSION_MINUTES = 60;

/** How far ahead the booking calendar lets clients pick. */
export const BOOKING_HORIZON_DAYS = 60;

/** Weekdays (0 = Sunday) that have at least one open window. */
export function openWeekdays(settings: BookingSettings): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => (settings.weekly[String(d) as keyof WeeklyHours] ?? []).length > 0);
}

/** Adds whole days to a "YYYY-MM-DD" string without timezone drift. */
export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + days));
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}-${String(at.getUTCDate()).padStart(2, "0")}`;
}

/** Weekday (0 = Sunday) for a "YYYY-MM-DD" string, matching slotsForDate. */
export function weekdayOfISO(dateISO: string): number {
  return new Date(`${dateISO}T12:00:00Z`).getUTCDay();
}

/** Local wall time in a timezone → instant. Handles DST by asking Intl the offset at that moment. */
export function zonedTime(dateISO: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMinutes(new Date(guess), timeZone);
  let result = new Date(guess - offset * 60000);
  const offset2 = tzOffsetMinutes(result, timeZone);
  if (offset2 !== offset) result = new Date(guess - offset2 * 60000);
  return result;
}

export function tzOffsetMinutes(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUTC - at.getTime()) / 60000);
}

export function localDateISO(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export type Busy = { starts_at: string; ends_at: string };

/**
 * Open slots for one local date. Pure: pass the existing busy ranges. Respects
 * lead time, buffers, blocked dates, and the daily maximum of booked sessions.
 */
export function slotsForDate(dateISO: string, timeZone: string, settings: BookingSettings, durationMinutes: number, busy: Busy[], now = new Date()): Date[] {
  if (!settings.enabled || settings.blockedDates.includes(dateISO)) return [];
  const weekday = String(new Date(`${dateISO}T12:00:00Z`).getUTCDay()) as keyof WeeklyHours;
  const windows = settings.weekly[weekday] ?? [];
  const buffered = busy.map((b) => ({ start: new Date(b.starts_at).getTime() - settings.bufferMinutes * 60000, end: new Date(b.ends_at).getTime() + settings.bufferMinutes * 60000 }));
  const dayBusy = busy.filter((b) => localDateISO(new Date(b.starts_at), timeZone) === dateISO).length;
  if (dayBusy >= settings.maxPerDay) return [];
  const earliest = now.getTime() + settings.leadTimeHours * 3600000;
  const step = Math.max(5, settings.slotStepMinutes) * 60000;
  const out: Date[] = [];
  for (const w of windows) {
    const start = zonedTime(dateISO, w.start, timeZone).getTime();
    const end = zonedTime(dateISO, w.end, timeZone).getTime();
    for (let t = start; t + durationMinutes * 60000 <= end; t += step) {
      if (t < earliest) continue;
      const slotEnd = t + durationMinutes * 60000;
      const clash = buffered.some((b) => t < b.end && slotEnd > b.start);
      if (!clash) out.push(new Date(t));
    }
  }
  return out;
}
