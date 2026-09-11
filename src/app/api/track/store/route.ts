import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { studioBySlug } from "@/lib/tenant-data";
import { track, type AnalyticsEvent } from "@/lib/analytics";

// Only the buyer-facing funnel events; checkout_start and purchase are counted
// server-side where the money moves, never from a spoofable client beacon.
const CLIENT_EVENTS = new Set<AnalyticsEvent>(["store_view", "product_view", "cart_add"]);

/**
 * Store funnel beacon (S25): counts a studio's shop/product views and cart adds
 * per day. Resolves the studio from the tenant host (x-tenant-slug, set by the
 * proxy); no cookie, IP or identifier is stored. Always 204; never throws.
 */
export async function POST(request: NextRequest) {
  try {
    const slug = (await headers()).get("x-tenant-slug");
    if (!slug) return new NextResponse(null, { status: 204 });
    const body = (await request.json()) as { event?: unknown; target?: unknown };
    const event = body.event as AnalyticsEvent;
    if (typeof event !== "string" || !CLIENT_EVENTS.has(event)) return new NextResponse(null, { status: 204 });
    const target = typeof body.target === "string" && body.target ? body.target.slice(0, 200) : event === "store_view" ? "shop" : "";
    if (!target) return new NextResponse(null, { status: 204 });
    const studio = await studioBySlug(slug);
    if (studio) await track(studio.id, event, target);
  } catch {
    // Analytics must never break the storefront.
  }
  return new NextResponse(null, { status: 204 });
}
