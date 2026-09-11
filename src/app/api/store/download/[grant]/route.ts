import { NextResponse, type NextRequest } from "next/server";
import { db, one } from "@/lib/db";
import { getUsableGrantByToken, recordGrantDownload } from "@/lib/store";
import { assetById } from "@/lib/assets";
import { getPrivateBlob, safeFilename } from "@/lib/storage";
import { clientIp, limited } from "@/lib/rate-limit";
import type { SaleItem } from "@/lib/types";

/**
 * Streams a purchased file after checking the grant's capability token, expiry
 * and per-order download cap. Gallery originals stream from the private store;
 * portfolio assets from the public one. Every hit is logged and counted.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ grant: string }> }) {
  const { grant: token } = await params;
  const rl = await limited("store_download", clientIp(request.headers));
  if (!rl.ok) return new NextResponse("Too many downloads. Try again shortly.", { status: 429 });

  const grant = await getUsableGrantByToken(token);
  if (!grant) return new NextResponse("This download link has expired or reached its limit.", { status: 410 });
  const item = one<SaleItem>(await db()`select * from sale_items where id = ${grant.sale_item_id}`);
  if (!item) return new NextResponse(null, { status: 404 });

  let url: string | null = null;
  let filename = "download.jpg";
  let priv = false;
  if (item.asset_id) {
    const asset = await assetById(grant.studio_id, item.asset_id);
    if (asset) {
      url = grant.resolution === "original" ? asset.url : asset.web_url ?? asset.url;
      filename = safeFilename(asset.filename, "photo.jpg");
    }
  } else if (item.photo_id) {
    const photo = one<{ original_url: string; preview_url: string; filename: string }>(await db()`select original_url, preview_url, filename from photos where id = ${item.photo_id}`);
    if (photo) {
      url = grant.resolution === "original" ? photo.original_url : photo.preview_url || photo.original_url;
      filename = safeFilename(photo.filename, "photo.jpg");
      priv = true;
    }
  }
  if (!url || url.startsWith("pending:")) return new NextResponse(null, { status: 404 });

  let body: BodyInit;
  let contentType = "application/octet-stream";
  let bytes = 0;
  if (priv) {
    const result = await getPrivateBlob(url);
    if (!result || result.statusCode === 304) return new NextResponse(null, { status: 404 });
    contentType = result.headers.get("content-type") ?? "application/octet-stream";
    body = result.stream as unknown as BodyInit;
  } else {
    const res = await fetch(url);
    if (!res.ok || !res.body) return new NextResponse(null, { status: 404 });
    contentType = res.headers.get("content-type") ?? "image/jpeg";
    bytes = Number(res.headers.get("content-length") ?? 0);
    body = res.body;
  }

  await recordGrantDownload(grant, { ip: clientIp(request.headers), ua: request.headers.get("user-agent"), bytes });
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename.replace(/["\\]/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
