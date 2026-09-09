import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { checkSlug } from "@/app/(auth)/actions";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const rl = await rateLimit(`slugcheck:${clientIp(await headers())}`, 60, 60);
  if (!rl.ok) return NextResponse.json({ ok: false, message: "Slow down" }, { status: 429 });
  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  return NextResponse.json(await checkSlug(slug), { headers: { "Cache-Control": "no-store" } });
}
