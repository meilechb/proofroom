import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { studioBySlug } from "@/lib/tenant-data";
import { track } from "@/lib/analytics";

const PATH_RE = /^\/[A-Za-z0-9\-/]{0,120}$/;

/**
 * Counts public-site views per path per day for one studio (plan 14.27). The
 * proxy sets x-tenant-slug on tenant hosts; we never store a cookie, an IP or a
 * query string. Always 204; never throws.
 */
export async function POST(request: NextRequest) {
  try {
    const slug = (await headers()).get("x-tenant-slug");
    if (!slug) return new NextResponse(null, { status: 204 });
    const body = (await request.json()) as { path?: unknown };
    let path = "/";
    if (typeof body.path === "string" && PATH_RE.test(body.path)) path = body.path;
    else return new NextResponse(null, { status: 204 });
    // Client-app and API paths are not public-site pages.
    if (/^\/(g|pay|my|u|invoice|receipt|team|api)(\/|$)/.test(path)) return new NextResponse(null, { status: 204 });
    const studio = await studioBySlug(slug);
    if (studio) await track(studio.id, "site_view", path);
  } catch {
    // Analytics must never break the site.
  }
  return new NextResponse(null, { status: 204 });
}
