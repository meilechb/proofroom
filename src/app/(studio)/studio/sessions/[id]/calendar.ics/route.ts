import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth";
import { getOrder } from "@/lib/orders";
import { slotForOrder } from "@/lib/booking";
import { db, one } from "@/lib/db";
import { icalFeed } from "@/lib/ical";
import { appUrl } from "@/lib/env";

/**
 * GET /studio/sessions/{id}/calendar.ics: one session as a calendar file, for
 * "Add to calendar" on the session page. Signed-in studio members only.
 */
export async function GET(_request: Request, ctx: RouteContext<"/studio/sessions/[id]/calendar.ics">) {
  const { id } = await ctx.params;
  let studioId: string;
  try {
    studioId = (await requireStudio()).studio.id;
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const order = await getOrder(studioId, id);
  if (!order || !order.scheduled_at) return new NextResponse("Not found", { status: 404 });
  const [client, slot, pkg] = await Promise.all([
    one<{ name: string; email: string }>(await db()`select name, email from clients where id = ${order.client_id} and studio_id = ${studioId}`),
    slotForOrder(studioId, order.id),
    order.package_id ? one<{ duration_minutes: number | null }>(await db()`select duration_minutes from packages where id = ${order.package_id}`) : null,
  ]);
  const start = new Date(order.scheduled_at);
  const end = slot?.status === "confirmed" ? new Date(slot.ends_at) : new Date(start.getTime() + (pkg?.duration_minutes ?? 60) * 60000);
  const body = icalFeed(`Session #${order.order_number}`, [
    {
      uid: `session-${order.id}`,
      title: client ? `${order.title} · ${client.name}` : order.title,
      start,
      end,
      location: order.location,
      description: [client ? `${client.name} <${client.email}>` : null, order.notes].filter(Boolean).join("\n") || null,
      url: `${appUrl()}/studio/sessions/${order.id}`,
    },
  ]);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="session-${order.order_number}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
