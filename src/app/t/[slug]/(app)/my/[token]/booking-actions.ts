"use server";

import { revalidatePath } from "next/cache";
import { db, one, isUuid } from "@/lib/db";
import { studioBySlug, siteOf } from "@/lib/tenant-data";
import { verifyLink } from "@/lib/tenant-tokens";
import { bookingSettings, withinChangeWindow, localDateISO, zonedTime, slotsForDate, DEFAULT_SESSION_MINUTES } from "@/lib/booking-shared";
import { busyRanges } from "@/lib/booking";
import { cancelOrder } from "@/lib/orders";
import { getTemplate } from "@/lib/email-templates-server";
import { renderTemplate } from "@/lib/email-templates";
import { sendStudioEmail, sendPlatformEmail } from "@/lib/email";
import { recordClientEvent } from "@/lib/clients";
import { clientHubUrl } from "@/lib/tenant";
import { signLink } from "@/lib/tenant-tokens";
import type { Studio } from "@/lib/types";
import { log } from "@/lib/logger";

/** Client-facing reschedule and cancel from the hub, within the studio's policy window (plan 21.13). */

type BookingRow = { id: string; starts_at: string; ends_at: string; status: string; order_id: string | null; package_id: string | null };

type Ctx = { studio: Studio; clientId: string; booking: BookingRow };

async function loadBooking(slug: string, token: string, bookingId: string): Promise<Ctx | { error: string }> {
  if (!isUuid(bookingId)) return { error: "Booking not found." };
  const studio = await studioBySlug(slug);
  if (!studio) return { error: "Something went wrong." };
  const clientId = verifyLink("hub", token);
  if (!clientId) return { error: "Your link has expired. Request a new one below." };
  const booking = one<BookingRow>(
    await db()`select id, starts_at, ends_at, status, order_id, package_id from booking_slots where id = ${bookingId} and studio_id = ${studio.id} and client_id = ${clientId} and status = 'confirmed' and starts_at >= now() limit 1`
  );
  if (!booking) return { error: "That booking can no longer be changed." };
  return { studio, clientId, booking };
}

function studioAddress(studio: Studio) {
  const a = siteOf(studio).settings.address;
  return [a.street, a.locality, a.region, a.postalCode].filter(Boolean).join(", ");
}

export type SlotOption = { iso: string; label: string };

/** Open times for a reschedule, using the booking's own duration and excluding its current slot. */
export async function rescheduleSlotsAction(slug: string, token: string, bookingId: string, dateISO: string): Promise<{ ok: true; slots: SlotOption[] } | { ok: false; error: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return { ok: false, error: "Pick a date." };
  const ctx = await loadBooking(slug, token, bookingId);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { studio, booking } = ctx;
  const settings = bookingSettings((studio.settings ?? {}) as Record<string, unknown>);
  if (!settings.enabled) return { ok: false, error: "Booking is closed right now." };
  const pkg = booking.package_id ? one<{ duration_minutes: number | null }>(await db()`select duration_minutes from packages where id = ${booking.package_id} and studio_id = ${studio.id}`) : null;
  const duration = pkg?.duration_minutes ?? (Math.round((new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime()) / 60000) || DEFAULT_SESSION_MINUTES);
  const tz = studio.timezone || "UTC";
  const dayStart = zonedTime(dateISO, "00:00", tz).getTime();
  const busyAll = await busyRanges(studio.id, new Date(dayStart - settings.bufferMinutes * 60000), new Date(dayStart + 24 * 3600000 + settings.bufferMinutes * 60000));
  const busy = busyAll.filter((b) => !(b.starts_at === booking.starts_at && b.ends_at === booking.ends_at));
  const slots = slotsForDate(dateISO, tz, settings, duration, busy);
  return { ok: true, slots: slots.map((s) => ({ iso: s.toISOString(), label: s.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }) })) };
}

export type BookingActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function cancelBookingAction(slug: string, token: string, bookingId: string): Promise<BookingActionResult> {
  const ctx = await loadBooking(slug, token, bookingId);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { studio, clientId, booking } = ctx;
  const settings = bookingSettings((studio.settings ?? {}) as Record<string, unknown>);
  if (!withinChangeWindow(new Date(booking.starts_at), settings.cancelWindowHours)) {
    return { ok: false, error: `Cancellations are closed within ${settings.cancelWindowHours} hours of the session. Please contact ${studio.name}.` };
  }
  if (booking.order_id) await cancelOrder(studio.id, booking.order_id, "Cancelled by client from the portal");
  else await db()`update booking_slots set status = 'cancelled', hold_expires_at = null where id = ${booking.id} and studio_id = ${studio.id}`;

  const client = one<{ name: string; email: string }>(await db()`select name, email from clients where id = ${clientId}`);
  await recordClientEvent(studio.id, clientId, "booking.cancelled", "booking_slot", booking.id, "Client cancelled their booking from the portal");
  const tz = studio.timezone || "UTC";
  const when = new Date(booking.starts_at).toLocaleString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  await sendPlatformEmail({ to: studio.email, subject: `Booking cancelled: ${client?.name ?? "A client"}`, text: `${client?.name ?? "A client"} cancelled their session set for ${when}.`, replyTo: client?.email, kind: "booking_cancelled_notice" }).catch(() => {});
  if (client?.email) await sendStudioEmail(studio, { to: client.email, subject: `Your session with ${studio.name} is cancelled`, text: `Hi ${client.name},\n\nYour session for ${when} has been cancelled. If this was a mistake, just book again or reply to this email.`, kind: "booking_cancelled", related: booking.order_id ? { type: "order", id: booking.order_id } : null }).catch(() => {});
  revalidatePath(`/t/${slug}/my/${token}`);
  return { ok: true, message: "Your session has been cancelled." };
}

/** Moves an existing booking to a new time the client picked (plan 21.13). */
export async function rescheduleBookingAction(slug: string, token: string, bookingId: string, newSlotISO: string): Promise<BookingActionResult> {
  const ctx = await loadBooking(slug, token, bookingId);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { studio, clientId, booking } = ctx;
  const settings = bookingSettings((studio.settings ?? {}) as Record<string, unknown>);
  if (!settings.enabled) return { ok: false, error: "Booking is closed right now." };
  if (!withinChangeWindow(new Date(booking.starts_at), settings.cancelWindowHours)) {
    return { ok: false, error: `Changes are closed within ${settings.cancelWindowHours} hours of the session. Please contact ${studio.name}.` };
  }
  const startsAt = new Date(newSlotISO);
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "Pick a time." };

  const pkg = booking.package_id ? one<{ duration_minutes: number | null }>(await db()`select duration_minutes from packages where id = ${booking.package_id} and studio_id = ${studio.id}`) : null;
  const durationMs = new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime();
  const duration = pkg?.duration_minutes ?? (Math.round(durationMs / 60000) || DEFAULT_SESSION_MINUTES);
  const tz = studio.timezone || "UTC";
  const dateISO = localDateISO(startsAt, tz);
  const dayStart = zonedTime(dateISO, "00:00", tz).getTime();
  const busyAll = await busyRanges(studio.id, new Date(dayStart - settings.bufferMinutes * 60000), new Date(dayStart + 24 * 3600000 + settings.bufferMinutes * 60000));
  // Don't let the booking's own current slot block its new time.
  const busy = busyAll.filter((b) => !(b.starts_at === booking.starts_at && b.ends_at === booking.ends_at));
  const open = slotsForDate(dateISO, tz, settings, duration, busy);
  if (!open.some((s) => s.getTime() === startsAt.getTime())) return { ok: false, error: "That time is no longer available. Please pick another." };

  const endsAt = new Date(startsAt.getTime() + duration * 60000);
  try {
    const moved = one<{ id: string }>(await db()`update booking_slots set starts_at = ${startsAt.toISOString()}, ends_at = ${endsAt.toISOString()} where id = ${booking.id} and studio_id = ${studio.id} and status = 'confirmed' returning id`);
    if (!moved) return { ok: false, error: "That booking can no longer be changed." };
  } catch (error) {
    if (error instanceof Error && /exclusion|conflict|overlap/i.test(error.message)) return { ok: false, error: "That time was just taken. Please pick another." };
    log.error("reschedule.move_failed", { booking: booking.id, error: error instanceof Error ? error.message : String(error) });
    return { ok: false, error: "Could not move that booking. Please try again." };
  }
  if (booking.order_id) await db()`update orders set scheduled_at = ${startsAt.toISOString()}, shoot_date = ${dateISO} where id = ${booking.order_id} and studio_id = ${studio.id}`;

  const client = one<{ name: string; email: string }>(await db()`select name, email from clients where id = ${clientId}`);
  await recordClientEvent(studio.id, clientId, "booking.rescheduled", "booking_slot", booking.id, "Client rescheduled their booking from the portal");
  const dateLabel = startsAt.toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeLabel = startsAt.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  const hubUrl = clientHubUrl(studio, signLink("hub", clientId));
  if (client?.email) {
    const tmpl = await getTemplate(studio.id, "booking_confirmed");
    const vars = { client_name: client.name, session_title: "Your session", session_date: dateLabel, session_time: timeLabel, location: studioAddress(studio), hub_url: hubUrl };
    await sendStudioEmail(studio, { to: client.email, subject: renderTemplate(tmpl.values.subject, vars), text: renderTemplate(tmpl.values.body, vars), cta: tmpl.values.cta_label ? { label: tmpl.values.cta_label, url: hubUrl } : undefined, kind: "booking_rescheduled", templateKey: "booking_confirmed", related: booking.order_id ? { type: "order", id: booking.order_id } : null }).catch(() => {});
  }
  await sendPlatformEmail({ to: studio.email, subject: `Booking moved: ${client?.name ?? "A client"}`, text: `${client?.name ?? "A client"} moved their session to ${dateLabel} at ${timeLabel}.`, replyTo: client?.email, kind: "booking_rescheduled_notice" }).catch(() => {});
  revalidatePath(`/t/${slug}/my/${token}`);
  return { ok: true, message: `Moved to ${dateLabel} at ${timeLabel}.` };
}
