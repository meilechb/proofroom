"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_BOOKING, type BookingSettings, type WeeklyHours } from "@/lib/booking-shared";
import type { ActionState } from "@/lib/action-state";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function cleanWeekly(raw: unknown): WeeklyHours {
  const out = {} as WeeklyHours;
  const w = (raw ?? {}) as Record<string, Array<{ start?: unknown; end?: unknown }>>;
  for (const day of ["0", "1", "2", "3", "4", "5", "6"] as const) {
    const windows = Array.isArray(w[day]) ? w[day] : [];
    out[day] = windows
      .map((win) => ({ start: String(win.start ?? ""), end: String(win.end ?? "") }))
      .filter((win) => HHMM.test(win.start) && HHMM.test(win.end) && win.start < win.end)
      .slice(0, 4);
  }
  return out;
}

/** Save booking availability settings (plan 21.9). */
export async function saveBookingSettingsAction(input: BookingSettings): Promise<ActionState> {
  const { studio } = await requireWritableStudio("admin");
  const clean: BookingSettings = {
    enabled: Boolean(input.enabled),
    weekly: cleanWeekly(input.weekly),
    bufferMinutes: clamp(input.bufferMinutes, 0, 120, DEFAULT_BOOKING.bufferMinutes),
    leadTimeHours: clamp(input.leadTimeHours, 0, 720, DEFAULT_BOOKING.leadTimeHours),
    maxPerDay: clamp(input.maxPerDay, 1, 24, DEFAULT_BOOKING.maxPerDay),
    slotStepMinutes: clamp(input.slotStepMinutes, 5, 120, DEFAULT_BOOKING.slotStepMinutes),
    depositRequired: Boolean(input.depositRequired),
    policy: String(input.policy ?? "").slice(0, 1000),
    blockedDates: Array.isArray(input.blockedDates) ? input.blockedDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 366) : [],
  };
  await db()`update studios set settings = settings || ${JSON.stringify({ booking: clean })}::jsonb where id = ${studio.id}`;
  revalidatePath("/studio/settings/bookings");
  return { ok: true, message: "Booking settings saved." };
}

function clamp(n: unknown, min: number, max: number, fallback: number) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
}
