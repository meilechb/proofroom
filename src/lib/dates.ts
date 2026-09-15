/**
 * Date formatting in a studio's timezone. Server code runs in UTC, so any
 * client-facing date (session reminders, agreements, gallery expiry) has to be
 * formatted with the studio's IANA zone or it can show the wrong day.
 */

import { zonedTime } from "@/lib/booking-shared";

function safeZone(timeZone: string | null | undefined) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timeZone || "UTC" });
    return timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function formatInZone(value: string | Date, timeZone: string | null | undefined, opts: Intl.DateTimeFormatOptions) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: safeZone(timeZone) }).format(d);
}

/** "Tuesday, March 3" */
export function formatDayInZone(value: string | Date, timeZone: string | null | undefined) {
  return formatInZone(value, timeZone, { weekday: "long", month: "long", day: "numeric" });
}

/** "March 3, 2026" */
export function formatLongDateInZone(value: string | Date, timeZone: string | null | undefined) {
  return formatInZone(value, timeZone, { month: "long", day: "numeric", year: "numeric" });
}

/** "2:30 PM" */
export function formatTimeInZone(value: string | Date, timeZone: string | null | undefined) {
  return formatInZone(value, timeZone, { hour: "numeric", minute: "2-digit" });
}

/** The calendar date (YYYY-MM-DD) an instant falls on in the zone. */
export function dateISOInZone(value: string | Date, timeZone: string | null | undefined) {
  const d = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: safeZone(timeZone), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The last second of a calendar date in the zone, as an instant. */
export function endOfDayInZone(dateISO: string, timeZone: string | null | undefined) {
  const start = zonedTime(dateISO, "23:59", safeZone(timeZone));
  return new Date(start.getTime() + 59_000);
}
