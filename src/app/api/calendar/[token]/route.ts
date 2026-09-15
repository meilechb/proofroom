import { NextResponse } from "next/server";
import { verifyLink } from "@/lib/tenant-tokens";
import { db, one } from "@/lib/db";
import { calendarEvents, calendarItems } from "@/lib/calendar";
import { icalFeed } from "@/lib/ical";
import { appUrl } from "@/lib/env";

/**
 * GET /api/calendar/{token}: iCal feed of a studio's sessions and bookings, for
 * Google Calendar, Apple Calendar and Outlook subscriptions. The token is
 * signed (see lib/calendar.ts); there is no session, calendar apps cannot log in.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/calendar/[token]">) {
  const { token } = await ctx.params;
  const studioId = verifyLink("calendar", token);
  if (!studioId) return new NextResponse("Not found", { status: 404 });
  const studio = one<{ id: string; name: string }>(await db()`select id, name from studios where id = ${studioId} and deleted_at is null and suspended_at is null`);
  if (!studio) return new NextResponse("Not found", { status: 404 });
  const from = new Date(Date.now() - 90 * 86400000);
  const to = new Date(Date.now() + 366 * 86400000);
  const items = await calendarItems(studio.id, from, to);
  const body = icalFeed(`${studio.name} sessions`, calendarEvents(items, appUrl()));
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${studio.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-sessions.ics"`,
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
