import { NextResponse } from "next/server";
import { recordMarketingView } from "@/lib/analytics";

const PATH_RE = /^\/[A-Za-z0-9\-/]{0,120}$/;

/** POST { path, referrer } from the marketing beacon. Always 204; never throws (plan 8.21). */
export async function POST(request: Request) {
  let path = "/";
  let referrer: string | null = null;
  try {
    const body = (await request.json()) as { path?: unknown; referrer?: unknown };
    if (typeof body.path === "string" && PATH_RE.test(body.path)) path = body.path;
    else return new NextResponse(null, { status: 204 });
    if (typeof body.referrer === "string" && /^[a-z0-9.-]{1,120}$/i.test(body.referrer)) referrer = body.referrer.toLowerCase();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  // Studio, tenant and API paths are never marketing pages.
  if (/^\/(studio|admin|api|t)(\/|$)/.test(path)) return new NextResponse(null, { status: 204 });
  await recordMarketingView(path, referrer);
  return new NextResponse(null, { status: 204 });
}
