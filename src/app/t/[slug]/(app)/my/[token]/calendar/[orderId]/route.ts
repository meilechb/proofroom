import { NextResponse } from "next/server";
import { verifyLink } from "@/lib/tenant-tokens";
import { db, one, isUuid } from "@/lib/db";
import { studioBySlug } from "@/lib/tenant-data";
import { slotForOrder } from "@/lib/booking";
import { icalFeed } from "@/lib/ical";
import { studioBaseUrl } from "@/lib/tenant";
import type { Order } from "@/lib/types";

/**
 * GET /my/{token}/calendar/{orderId}: a client's scheduled session as a
 * calendar file, reachable with the same hub link the client already has.
 */
export async function GET(_request: Request, ctx: RouteContext<"/t/[slug]/my/[token]/calendar/[orderId]">) {
  const { slug, token, orderId } = await ctx.params;
  const clientId = verifyLink("hub", token);
  if (!clientId || !isUuid(orderId)) return new NextResponse("Not found", { status: 404 });
  const studio = await studioBySlug(slug);
  if (!studio) return new NextResponse("Not found", { status: 404 });
  const order = one<Order>(await db()`select * from orders where id = ${orderId} and studio_id = ${studio.id} and client_id = ${clientId} and status not in ('cancelled', 'draft')`);
  if (!order?.scheduled_at) return new NextResponse("Not found", { status: 404 });
  const [slot, pkg] = await Promise.all([
    slotForOrder(studio.id, order.id),
    order.package_id ? one<{ duration_minutes: number | null }>(await db()`select duration_minutes from packages where id = ${order.package_id}`) : null,
  ]);
  const start = new Date(order.scheduled_at);
  const end = slot?.status === "confirmed" ? new Date(slot.ends_at) : new Date(start.getTime() + (pkg?.duration_minutes ?? 60) * 60000);
  const body = icalFeed(studio.name, [
    {
      uid: `session-${order.id}`,
      title: `${order.title} with ${studio.name}`,
      start,
      end,
      location: order.location,
      description: `Questions? ${studio.email}`,
      url: `${studioBaseUrl(studio)}/my/${token}`,
    },
  ]);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="session-${order.order_number}.ics"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
