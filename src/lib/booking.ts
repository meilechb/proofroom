import "server-only";

import { db, one, rows } from "@/lib/db";
import { HOLD_MINUTES, type Busy } from "@/lib/booking-shared";

/**
 * Booking database functions (plan 3.89, 21.10-21.12). Pure types and slot math
 * live in booking-shared; this module holds the queries that touch the DB.
 */

export type { WeeklyHours, BookingSettings, Busy } from "@/lib/booking-shared";
export { DEFAULT_BOOKING, HOLD_MINUTES, DEFAULT_SESSION_MINUTES, BOOKING_HORIZON_DAYS, bookingSettings, zonedTime, tzOffsetMinutes, localDateISO, slotsForDate, openWeekdays, overrideDates, addDaysISO, weekdayOfISO, withinChangeWindow } from "@/lib/booking-shared";

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

/** The confirmed booking a session holds, if any (for the session page and no-show marking). */
export async function slotForOrder(studioId: string, orderId: string) {
  return one<{ id: string; starts_at: string; ends_at: string; status: string }>(
    await db()`select id, starts_at, ends_at, status from booking_slots where order_id = ${orderId} and studio_id = ${studioId} order by starts_at desc limit 1`
  );
}

/** Marks the session's booking as a no-show (plan 21.14). */
export async function markOrderNoShow(studioId: string, orderId: string) {
  return one<{ id: string }>(
    await db()`update booking_slots set status = 'no_show' where order_id = ${orderId} and studio_id = ${studioId} and status = 'confirmed' returning id`
  );
}

/** Cron (frequent): expired holds are released. */
export async function releaseExpiredHolds() {
  const released = await db()`update booking_slots set status = 'cancelled' where status = 'held' and hold_expires_at < now() returning id`;
  return released.length;
}

// --- Studio "Bookings" page (plan 21.16): requests from the site + upcoming confirmed sessions ---

export type BookingRequestRow = {
  id: string; people_count: number | null; preferred_dates: string | null; location_pref: string | null; created_at: string;
  inquiry_id: string | null; name: string | null; email: string | null; phone: string | null; message: string | null;
  inquiry_status: string | null; package_name: string | null;
};

export type UpcomingBooking = {
  id: string; starts_at: string; ends_at: string; status: string;
  client_name: string | null; order_title: string | null; order_number: number | null; package_name: string | null;
};

/** Booking-form submissions from the studio's website, newest first. */
export async function listBookingRequests(studioId: string): Promise<BookingRequestRow[]> {
  return rows<BookingRequestRow>(
    await db()`
      select br.id, br.people_count, br.preferred_dates, br.location_pref, br.created_at,
             i.id as inquiry_id, i.name, i.email, i.phone, i.message, i.status as inquiry_status,
             p.name as package_name
      from booking_requests br
      left join inquiries i on i.id = br.inquiry_id
      left join packages p on p.id = br.package_id
      where br.studio_id = ${studioId}
      order by br.created_at desc limit 100`
  );
}

/** Confirmed bookings that have not finished yet, soonest first. */
export async function upcomingBookings(studioId: string): Promise<UpcomingBooking[]> {
  return rows<UpcomingBooking>(
    await db()`
      select bs.id, bs.starts_at, bs.ends_at, bs.status,
             c.name as client_name, o.title as order_title, o.order_number, p.name as package_name
      from booking_slots bs
      left join clients c on c.id = bs.client_id
      left join orders o on o.id = bs.order_id
      left join packages p on p.id = bs.package_id
      where bs.studio_id = ${studioId} and bs.status = 'confirmed' and bs.ends_at >= now()
      order by bs.starts_at asc limit 100`
  );
}

export async function bookingCounts(studioId: string): Promise<{ requests: number; upcoming: number; held: number }> {
  const r = one<{ requests: number; upcoming: number; held: number }>(
    await db()`
      select
        (select count(*) from booking_requests where studio_id = ${studioId})::int as requests,
        (select count(*) from booking_slots where studio_id = ${studioId} and status = 'confirmed' and ends_at >= now())::int as upcoming,
        (select count(*) from booking_slots where studio_id = ${studioId} and status = 'held' and hold_expires_at > now())::int as held`
  );
  return r ?? { requests: 0, upcoming: 0, held: 0 };
}

// --- Studio Calendar (plan 21.17): shoots, holds and blocked days for a month ---

export type CalShoot = { id: string; order_number: number; title: string; scheduled_at: string; status: string; client_name: string | null };
export type CalHold = { id: string; starts_at: string; ends_at: string };

/** Scheduled sessions in [from, to). Cancelled and draft sessions are left off. */
export async function calendarShoots(studioId: string, from: Date, to: Date): Promise<CalShoot[]> {
  return rows<CalShoot>(
    await db()`
      select o.id, o.order_number, o.title, o.scheduled_at, o.status, c.name as client_name
      from orders o left join clients c on c.id = o.client_id
      where o.studio_id = ${studioId} and o.scheduled_at is not null
        and o.scheduled_at >= ${from.toISOString()} and o.scheduled_at < ${to.toISOString()}
        and o.status not in ('cancelled', 'draft')
      order by o.scheduled_at asc`
  );
}

/** Live (unexpired) holds in [from, to) — tentative bookings not yet confirmed. */
export async function calendarHolds(studioId: string, from: Date, to: Date): Promise<CalHold[]> {
  return rows<CalHold>(
    await db()`
      select id, starts_at, ends_at from booking_slots
      where studio_id = ${studioId} and status = 'held' and hold_expires_at > now()
        and starts_at >= ${from.toISOString()} and starts_at < ${to.toISOString()}
      order by starts_at asc`
  );
}
