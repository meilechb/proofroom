"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { studioBySlug, siteOf } from "@/lib/tenant-data";
import { bookingSettings, slotsForDate, localDateISO, zonedTime, DEFAULT_SESSION_MINUTES } from "@/lib/booking-shared";
import { busyRanges, holdSlot, confirmSlot } from "@/lib/booking";
import { createClient } from "@/lib/clients";
import { createOrder } from "@/lib/orders";
import { listPackages } from "@/lib/packages";
import { getTemplate } from "@/lib/email-templates-server";
import { renderTemplate } from "@/lib/email-templates";
import { sendStudioEmail, sendPlatformEmail } from "@/lib/email";
import { amountForKind, createOrderCheckout, defaultPayUrls } from "@/lib/payments";
import { canTakeCardPayments } from "@/lib/connect";
import { billingState } from "@/lib/plans";
import { notifiableMembers } from "@/lib/notifications";
import { signLink } from "@/lib/tenant-tokens";
import { clientHubUrl } from "@/lib/tenant";
import { limited, clientIp } from "@/lib/rate-limit";
import { emailSchema } from "@/lib/validation";
import { formatMoney, type Studio } from "@/lib/types";
import { log } from "@/lib/logger";

/**
 * Public booking actions for the tenant /book page (plan 21.10-21.12). Slots are
 * recomputed here against live bookings, then a slot is held, the client and
 * order are created, the slot is confirmed, and everyone is emailed. When a
 * deposit is required the client is sent to Checkout on the studio's own account.
 */

export type SlotOption = { iso: string; label: string };
type SlotsResult = { ok: true; slots: SlotOption[] } | { ok: false; error: string };

function bookableFor(studio: Studio) {
  return listPackages(studio.id, true).then((pkgs) => pkgs.filter((p) => p.bookable));
}

function timeLabel(at: Date, tz: string) {
  return at.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
}

/** Times still open on a given local date for the chosen package. */
export async function availableSlotsAction(slug: string, packageId: string, dateISO: string): Promise<SlotsResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return { ok: false, error: "Pick a date." };
  const studio = await studioBySlug(slug);
  if (!studio) return { ok: false, error: "Something went wrong." };
  const settings = bookingSettings((studio.settings ?? {}) as Record<string, unknown>);
  if (!settings.enabled) return { ok: false, error: "Booking is closed right now." };
  const pkg = (await bookableFor(studio)).find((p) => p.id === packageId);
  if (!pkg) return { ok: false, error: "Choose a package first." };
  const tz = studio.timezone || "UTC";
  const duration = pkg.duration_minutes ?? DEFAULT_SESSION_MINUTES;
  const dayStart = zonedTime(dateISO, "00:00", tz).getTime();
  const from = new Date(dayStart - settings.bufferMinutes * 60000);
  const to = new Date(dayStart + 24 * 3600000 + settings.bufferMinutes * 60000);
  const busy = await busyRanges(studio.id, from, to);
  const slots = slotsForDate(dateISO, tz, settings, duration, busy);
  return { ok: true, slots: slots.map((s) => ({ iso: s.toISOString(), label: timeLabel(s, tz) })) };
}

const bookInput = z.object({
  packageId: z.string().uuid(),
  slotISO: z.string().datetime({ offset: true }),
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: emailSchema,
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  agreed: z.boolean(),
});
export type BookFormInput = z.input<typeof bookInput>;

export type BookResult =
  | { ok: true; checkoutUrl: string | null; hubUrl: string; when: string }
  | { ok: false; error: string };

/** Holds and confirms a booking, creating the client, order and session (plan 21.12). */
export async function bookAction(slug: string, raw: BookFormInput): Promise<BookResult> {
  const studio = await studioBySlug(slug);
  if (!studio) return { ok: false, error: "Something went wrong." };
  const settings = bookingSettings((studio.settings ?? {}) as Record<string, unknown>);
  if (!settings.enabled) return { ok: false, error: "Booking is closed right now." };
  if (!billingState(studio).publicLive) return { ok: false, error: "This studio is not taking bookings right now." };

  const ip = clientIp(await headers());
  const rl = await limited("booking", `${studio.id}:${ip}`);
  if (!rl.ok) return { ok: false, error: "Too many attempts from this network. Try again in a little while." };

  const parsed = bookInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  const data = parsed.data;
  if (!data.agreed) return { ok: false, error: "Please agree to the booking policy." };

  const pkg = (await bookableFor(studio)).find((p) => p.id === data.packageId);
  if (!pkg) return { ok: false, error: "That package is no longer available." };
  const tz = studio.timezone || "UTC";
  const duration = pkg.duration_minutes ?? DEFAULT_SESSION_MINUTES;
  const startsAt = new Date(data.slotISO);
  const dateISO = localDateISO(startsAt, tz);

  // Re-check the slot against live availability so a stale page can't book a taken or closed time.
  const dayStart = zonedTime(dateISO, "00:00", tz).getTime();
  const busy = await busyRanges(studio.id, new Date(dayStart - settings.bufferMinutes * 60000), new Date(dayStart + 24 * 3600000 + settings.bufferMinutes * 60000));
  const open = slotsForDate(dateISO, tz, settings, duration, busy);
  if (!open.some((s) => s.getTime() === startsAt.getTime())) return { ok: false, error: "That time is no longer available. Please pick another." };

  let holdId: string;
  try {
    const hold = await holdSlot(studio.id, startsAt, duration, pkg.id);
    if (!hold) return { ok: false, error: "That time was just taken. Please pick another." };
    holdId = hold.id;
  } catch (error) {
    if (error instanceof Error && /just taken/i.test(error.message)) return { ok: false, error: error.message };
    log.error("book.hold_failed", { studio: studio.id, error: error instanceof Error ? error.message : String(error) });
    return { ok: false, error: "Could not hold that time. Please try again." };
  }

  const notes = data.notes || null;
  const { client } = await createClient(studio.id, { name: data.name, email: data.email, phone: data.phone || null, source: "booking", stage: "booked" });
  const order = await createOrder(studio.id, { clientId: client.id, packageId: pkg.id, scheduledAt: startsAt.toISOString(), notes });
  try {
    await confirmSlot(studio.id, holdId, { clientId: client.id, orderId: order.id, notes });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "That hold expired. Please pick a time again." };
  }

  const hubUrl = clientHubUrl(studio, signLink("hub", client.id));
  const dateLabel = startsAt.toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const at = timeLabel(startsAt, tz);
  const address = studioAddress(studio);

  const tmpl = await getTemplate(studio.id, "booking_confirmed");
  const vars = { client_name: client.name, session_title: pkg.name, session_date: dateLabel, session_time: at, location: address, hub_url: hubUrl };
  await sendStudioEmail(studio, {
    to: client.email,
    subject: renderTemplate(tmpl.values.subject, vars),
    text: renderTemplate(tmpl.values.body, vars),
    cta: tmpl.values.cta_label ? { label: tmpl.values.cta_label, url: hubUrl } : undefined,
    kind: "booking_confirmed",
    templateKey: "booking_confirmed",
    related: { type: "order", id: order.id },
  }).catch((e) => log.warn("book.client_email_failed", { error: e instanceof Error ? e.message : String(e) }));

  const members = await notifiableMembers(studio.id, "booking_made");
  const to = members.length ? members.map((m) => m.email) : [studio.email];
  await sendPlatformEmail({
    to,
    subject: `New booking: ${pkg.name} — ${dateLabel}`,
    text: `${client.name} <${client.email}> booked ${pkg.name}.\n\nWhen: ${dateLabel} at ${at}\nPhone: ${data.phone || "—"}\nAmount: ${formatMoney(order.amount_cents, order.currency)}${notes ? `\n\nNotes: ${notes}` : ""}`,
    replyTo: client.email,
    kind: "booking_notice",
  }).catch((e) => log.warn("book.studio_email_failed", { error: e instanceof Error ? e.message : String(e) }));

  let checkoutUrl: string | null = null;
  if (settings.depositRequired && canTakeCardPayments(studio)) {
    const amount = amountForKind(order, [], 0, "deposit");
    if (amount) {
      try {
        checkoutUrl = await createOrderCheckout(studio, order, client, "deposit", amount, defaultPayUrls(studio, order.id));
      } catch (error) {
        log.warn("book.deposit_checkout_failed", { order: order.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  return { ok: true, checkoutUrl, hubUrl, when: `${dateLabel} at ${at}` };
}

function studioAddress(studio: Studio) {
  const a = siteOf(studio).settings.address;
  return [a.street, a.locality, a.region, a.postalCode].filter(Boolean).join(", ");
}
