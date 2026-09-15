import "server-only";

import { db, rows } from "@/lib/db";
import { signLink } from "@/lib/tenant-tokens";
import { appUrl } from "@/lib/env";
import type { CalendarEvent } from "@/lib/ical";

/**
 * Studio calendar data (plan 3.63): scheduled sessions and confirmed booking
 * slots in one list, for the month view and the iCal feed.
 */

export type StudioCalendarItem = {
  id: string;
  kind: "session" | "booking" | "hold";
  title: string;
  starts_at: string;
  ends_at: string;
  client_name: string | null;
  client_id: string | null;
  order_id: string | null;
  location: string | null;
  status: string;
};

export async function calendarItems(studioId: string, from: Date, to: Date): Promise<StudioCalendarItem[]> {
  return rows<StudioCalendarItem>(
    await db()`
      select o.id, 'session' as kind, o.title, o.scheduled_at::text as starts_at,
        coalesce(b.ends_at, o.scheduled_at + make_interval(mins => coalesce(p.duration_minutes, 60)))::text as ends_at,
        c.name as client_name, c.id as client_id, o.id as order_id, o.location, o.status
      from orders o
        join clients c on c.id = o.client_id
        left join packages p on p.id = o.package_id
        left join lateral (select ends_at from booking_slots s where s.order_id = o.id and s.status = 'confirmed' order by starts_at desc limit 1) b on true
      where o.studio_id = ${studioId} and o.scheduled_at is not null and o.status not in ('cancelled', 'draft')
        and o.scheduled_at < ${to.toISOString()}::timestamptz and o.scheduled_at > ${from.toISOString()}::timestamptz - interval '1 day'
      union all
      select s.id, case when s.status = 'held' then 'hold' else 'booking' end as kind,
        coalesce(p.name, 'Booking'), s.starts_at::text, s.ends_at::text, c.name, c.id, s.order_id, null, s.status
      from booking_slots s
        left join packages p on p.id = s.package_id
        left join clients c on c.id = s.client_id
      where s.studio_id = ${studioId} and s.order_id is null
        and (s.status = 'confirmed' or (s.status = 'held' and s.hold_expires_at > now()))
        and s.starts_at < ${to.toISOString()}::timestamptz and s.ends_at > ${from.toISOString()}::timestamptz
      order by starts_at`
  );
}

export function calendarEvents(items: StudioCalendarItem[], base: string): CalendarEvent[] {
  return items
    .filter((i) => i.kind !== "hold")
    .map((i) => ({
      uid: `${i.kind}-${i.id}`,
      title: i.client_name ? `${i.title} · ${i.client_name}` : i.title,
      start: new Date(i.starts_at),
      end: new Date(i.ends_at),
      location: i.location,
      description: i.kind === "session" ? `Status: ${i.status}` : "Booked from the website",
      url: i.order_id ? `${base}/studio/sessions/${i.order_id}` : `${base}/studio/bookings`,
    }));
}

/**
 * Feed URL a calendar app can subscribe to. The token is anchored to the
 * studio's creation time so the same URL comes back on every visit; it can be
 * revoked only by rotating APP_SECRET, which is why the page says to treat it
 * like a password.
 */
export function calendarFeedUrl(studio: { id: string; created_at: string }) {
  const anchor = new Date(studio.created_at).getTime();
  return `${appUrl()}/api/calendar/${signLink("calendar", studio.id, 3650, anchor)}`;
}
