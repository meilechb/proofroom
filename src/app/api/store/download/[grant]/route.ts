import { NextResponse, type NextRequest } from "next/server";
import { db, one } from "@/lib/db";
import { getUsableGrantByToken, recordGrantDownload } from "@/lib/store";
import { assetById } from "@/lib/assets";
import { downloadBlob, makeWebVersion } from "@/lib/images";
import { getPrivateBlob, safeFilename } from "@/lib/storage";
import { clientIp, limited } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import type { SaleItem } from "@/lib/types";

// Longest-edge sizes for the non-original tiers (standard ≈ an 8×10 at 300dpi).
const STORE_EDGE: Record<string, number> = { web: 1600, standard: 2560 };

/**
 * Streams a purchased file after checking the grant's capability token, expiry
 * and per-order download cap. The delivered file is never watermarked: gallery
 * originals stream from the private store; web/standard tiers are rendered clean
 * from the original on demand (the stored preview_url may be watermarked);
 * portfolio assets stream from the public store. Every hit is logged and counted.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ grant: string }> }) {
  const { grant: token } = await params;
  const rl = await limited("store_download", clientIp(request.headers));
  if (!rl.ok) return new NextResponse("Too many downloads. Try again shortly.", { status: 429 });

  const grant = await getUsableGrantByToken(token);
  if (!grant) return new NextResponse("This download link has expired or reached its limit.", { status: 410 });
  const item = one<SaleItem>(await db()`select * from sale_items where id = ${grant.sale_item_id} and studio_id = ${grant.studio_id}`);
  if (!item) return new NextResponse(null, { status: 404 });

  let filename = "download.jpg";
  let rendered: Buffer | null = null; // a clean, resized JPEG we built on demand
  let streamUrl: string | null = null; // a URL to pass through as-is
  let priv = false;

  try {
    if (item.asset_id) {
      // Portfolio assets are shown clean publicly, so their web_url is not watermarked.
      const asset = await assetById(grant.studio_id, item.asset_id);
      if (asset) {
        streamUrl = grant.resolution === "original" ? asset.url : asset.web_url ?? asset.url;
        filename = safeFilename(asset.filename, "photo.jpg");
      }
    } else if (item.photo_id) {
      const photo = one<{ original_url: string; filename: string }>(
        await db()`select original_url, filename from photos where id = ${item.photo_id} and studio_id = ${grant.studio_id} and deleted_at is null`
      );
      if (photo && !photo.original_url.startsWith("pending:")) {
        filename = safeFilename(photo.filename, "photo.jpg");
        if (grant.resolution === "original") {
          streamUrl = photo.original_url;
          priv = true;
        } else {
          // preview_url can be watermarked — render a clean tier from the original instead.
          const original = await downloadBlob(photo.original_url, "galleries");
          rendered = (await makeWebVersion(original, STORE_EDGE[grant.resolution] ?? STORE_EDGE.standard)).buffer;
          filename = `${filename.replace(/\.[^.]+$/, "")}.jpg`;
        }
      }
    }
  } catch (error) {
    log.error("store.download_render_failed", { grant: grant.id, error: error instanceof Error ? error.message : String(error) });
    return new NextResponse("This file could not be prepared. Please try again.", { status: 500 });
  }

  let body: BodyInit;
  let contentType = "application/octet-stream";
  let bytes = 0;
  if (rendered) {
    body = rendered as unknown as BodyInit;
    contentType = "image/jpeg";
    bytes = rendered.length;
  } else if (!streamUrl || streamUrl.startsWith("pending:")) {
    return new NextResponse(null, { status: 404 });
  } else if (priv) {
    const result = await getPrivateBlob(streamUrl);
    if (!result || result.statusCode === 304) return new NextResponse(null, { status: 404 });
    contentType = result.headers.get("content-type") ?? "application/octet-stream";
    body = result.stream as unknown as BodyInit;
  } else {
    const res = await fetch(streamUrl);
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
