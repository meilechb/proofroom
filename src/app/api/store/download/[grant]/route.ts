import { NextResponse, type NextRequest } from "next/server";
import { db, one } from "@/lib/db";
import { getUsableGrantByToken, recordGrantDownload } from "@/lib/store";
import { resolveGrantFile } from "@/lib/store-delivery";
import { clientIp, limited } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import type { SaleItem } from "@/lib/types";

/**
 * Streams a purchased file after checking the grant's capability token, expiry
 * and per-order download cap. The delivered file is never watermarked (see
 * resolveGrantFile). Every hit is logged and counted.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ grant: string }> }) {
  const { grant: token } = await params;
  const rl = await limited("store_download", clientIp(request.headers));
  if (!rl.ok) return new NextResponse("Too many downloads. Try again shortly.", { status: 429 });

  const grant = await getUsableGrantByToken(token);
  if (!grant) return new NextResponse("This download link has expired or reached its limit.", { status: 410 });
  const item = one<SaleItem>(await db()`select * from sale_items where id = ${grant.sale_item_id} and studio_id = ${grant.studio_id}`);
  if (!item) return new NextResponse(null, { status: 404 });

  let file;
  try {
    file = await resolveGrantFile(grant, item);
  } catch (error) {
    log.error("store.download_render_failed", { grant: grant.id, error: error instanceof Error ? error.message : String(error) });
    return new NextResponse("This file could not be prepared. Please try again.", { status: 500 });
  }
  if (!file) return new NextResponse(null, { status: 404 });

  await recordGrantDownload(grant, { ip: clientIp(request.headers), ua: request.headers.get("user-agent"), bytes: file.bytes });
  return new NextResponse(file.body as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename.replace(/["\\]/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
