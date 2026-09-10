"use server";

import { revalidatePath } from "next/cache";
import { requireEntitledStudio } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_BOOKING, type BookingSettings, type WeeklyHours } from "@/lib/booking-shared";
import type { ActionState } from "@/lib/action-state";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function cleanWindows(raw: unknown): { start: string; end: string }[] {
  const windows = Array.isArray(raw) ? (raw as Array<{ start?: unknown; end?: unknown }>) : [];
  return windows
    .map((win) => ({ start: String(win.start ?? ""), end: String(win.end ?? "") }))
    .filter((win) => HHMM.test(win.start) && HHMM.test(win.end) && win.start < win.end)
    .slice(0, 4);
}

function cleanWeekly(raw: unknown): WeeklyHours {
  const out = {} as WeeklyHours;
  const w = (raw ?? {}) as Record<string, unknown>;
  for (const day of ["0", "1", "2", "3", "4", "5", "6"] as const) out[day] = cleanWindows(w[day]);
  return out;
}

function cleanOverrides(raw: unknown): Record<string, { start: string; end: string }[]> {
  const out: Record<string, { start: string; end: string }[]> = {};
  const o = (raw ?? {}) as Record<string, unknown>;
  for (const [date, windows] of Object.entries(o).slice(0, 200)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) out[date] = cleanWindows(windows);
  }
  return out;
}

/** Save booking availability settings (plan 21.9). */
export async function saveBookingSettingsAction(input: BookingSettings): Promise<ActionState> {
  const { studio } = await requireEntitledStudio("booking", "admin");
  const clean: BookingSettings = {
    enabled: Boolean(input.enabled),
    weekly: cleanWeekly(input.weekly),
    bufferMinutes: clamp(input.bufferMinutes, 0, 120, DEFAULT_BOOKING.bufferMinutes),
    leadTimeHours: clamp(input.leadTimeHours, 0, 720, DEFAULT_BOOKING.leadTimeHours),
    maxPerDay: clamp(input.maxPerDay, 1, 24, DEFAULT_BOOKING.maxPerDay),
    slotStepMinutes: clamp(input.slotStepMinutes, 5, 120, DEFAULT_BOOKING.slotStepMinutes),
    depositRequired: Boolean(input.depositRequired),
    cancelWindowHours: clamp(input.cancelWindowHours, 0, 720, DEFAULT_BOOKING.cancelWindowHours),
    policy: String(input.policy ?? "").slice(0, 1000),
    blockedDates: Array.isArray(input.blockedDates) ? input.blockedDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 366) : [],
    overrides: cleanOverrides(input.overrides),
  };
  await db()`update studios set settings = settings || ${JSON.stringify({ booking: clean })}::jsonb where id = ${studio.id}`;
  revalidatePath("/studio/settings/bookings");
  return { ok: true, message: "Booking settings saved." };
}

function clamp(n: unknown, min: number, max: number, fallback: number) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
}
