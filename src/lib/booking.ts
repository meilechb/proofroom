import "server-only";

import { db, one, rows } from "@/lib/db";

/**
 * Booking page availability (plan 3.89). Weekly hours in the studio's timezone
 * minus existing held/confirmed slots and buffers, cut into slots of the
 * package's duration. A hold lasts 15 minutes; the database exclusion
 * constraint makes a double booking impossible even under a race.
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

/** Local wall time in a timezone → instant. Handles DST by asking Intl what the offset is at that moment. */
export function zonedTime(dateISO: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMinutes(new Date(guess), timeZone);
  let result = new Date(guess - offset * 60000);
  // Re-check once in case the guess straddled a DST boundary.
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
 * Open slots for one local date (plan 3.89.1 to 3.89.3). Pure: pass the
 * existing busy ranges. Respects lead time, buffers, blocked dates, and the
 * daily maximum of already-booked sessions.
 */
export function slotsForDate(dateISO: string, timeZone: string, settings: BookingSettings, durationMinutes: number, busy: Busy[], now = new Date()): Date[] {
  if (!settings.enabled || settings.blockedDates.includes(dateISO)) return [];
  const weekday = String(new Date(`${dateISO}T12:00:00Z`).getUTCDay()) as keyof WeeklyHours;
  const windows = settings.weekly[weekday] ?? [];
  const busyRanges = busy.map((b) => ({ start: new Date(b.starts_at).getTime() - settings.bufferMinutes * 60000, end: new Date(b.ends_at).getTime() + settings.bufferMinutes * 60000 }));
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
      const clash = busyRanges.some((b) => t < b.end && slotEnd > b.start);
      if (!clash) out.push(new Date(t));
    }
  }
  return out;
}

export async function busyRanges(studioId: string, from: Date, to: Date): Promise<Busy[]> {
  return rows<Busy>(
    await db()`
      select starts_at, ends_at from booking_slots
      where studio_id = ${studioId} and status in ('held', 'confirmed') and (status <> 'held' or hold_expires_at > now())
        and starts_at < ${to.toISOString()} and ends_at > ${from.toISOString()}
      union all
      select scheduled_at, scheduled_at + interval '1 hour' from orders
      where studio_id = ${studioId} and scheduled_at is not null and status not in ('cancelled', 'draft', 'completed')
        and scheduled_at < ${to.toISOString()} and scheduled_at + interval '1 hour' > ${from.toISOString()}
        and not exists (select 1 from booking_slots b where b.order_id = orders.id)`
  );
}

/** Holds a slot for 15 minutes; the exclusion constraint rejects overlaps (plan 3.89.4). */
export async function holdSlot(studioId: string, startsAt: Date, durationMinutes: number, packageId: string | null) {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);
  try {
    return one<{ id: string; hold_expires_at: string }>(
      await db()`
        insert into booking_slots (studio_id, starts_at, ends_at, package_id, status, hold_expires_at)
        values (${studioId}, ${startsAt.toISOString()}, ${endsAt.toISOString()}, ${packageId}, 'held', now() + (${HOLD_MINUTES} || ' minutes')::interval)
        returning id, hold_expires_at`
    );
  } catch (error) {
    if (error instanceof Error && /exclusion|conflict|overlap/i.test(error.message)) throw new Error("That time was just taken. Pick another.");
    throw error;
  }
}

export async function confirmSlot(studioId: string, holdId: string, input: { clientId: string; orderId: string; notes?: string | null }) {
  const slot = one<{ id: string }>(
    await db()`
      update booking_slots set status = 'confirmed', client_id = ${input.clientId}, order_id = ${input.orderId}, notes = ${input.notes ?? null}, hold_expires_at = null
      where id = ${holdId} and studio_id = ${studioId} and status = 'held' and hold_expires_at > now()
      returning id`
  );
  if (!slot) throw new Error("This hold has expired. Pick a time again.");
  return slot;
}

export async function cancelSlot(studioId: string, slotId: string, status: "cancelled" | "no_show" | "completed" = "cancelled") {
  return one<{ id: string }>(await db()`update booking_slots set status = ${status} where id = ${slotId} and studio_id = ${studioId} returning id`);
}

/** Cron (frequent): expired holds are released. */
export async function releaseExpiredHolds() {
  const released = await db()`update booking_slots set status = 'cancelled' where status = 'held' and hold_expires_at < now() returning id`;
  return released.length;
}
