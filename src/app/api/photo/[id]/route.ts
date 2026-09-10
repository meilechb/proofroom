import { NextResponse, type NextRequest } from "next/server";
import { db, one } from "@/lib/db";
import { getPrivateBlob } from "@/lib/storage";
import { hasGalleryAccess, unlockMethod, downloadGate } from "@/lib/gallery-access";
import { listPayments } from "@/lib/payments";
import { getOrder } from "@/lib/orders";
import type { Gallery, Photo } from "@/lib/types";

/** GET /api/photo/[id]?size=thumb|web|full — streams a photo with access checks (plan 13.21). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const size = request.nextUrl.searchParams.get("size") ?? "web";

  const photo = one<Photo>(await db()`select * from photos where id = ${id} and deleted_at is null`);
  if (!photo || photo.preview_url === "" ) return new NextResponse(null, { status: 404 });
  const gallery = one<Gallery>(await db()`select * from galleries where id = ${photo.gallery_id}`);
  if (!gallery) return new NextResponse(null, { status: 404 });

  const open = unlockMethod(gallery) === "open" && gallery.status === "published";
  const unlocked = open || (await hasGalleryAccess(gallery.id));
  if (!unlocked) return new NextResponse(null, { status: 403 });

  if (size === "full") {
    const order = gallery.order_id ? await getOrder(gallery.studio_id, gallery.order_id) : null;
    const payments = gallery.order_id ? await listPayments(gallery.order_id) : [];
    const picks = (await db()`select count(*)::int as n from photo_selections s where s.gallery_id = ${gallery.id} and s.selected`)[0] as { n: number } | undefined;
    if (downloadGate(gallery, order, payments, picks?.n ?? 0) !== "open") return new NextResponse(null, { status: 402 });
  }

  const url = size === "full" ? photo.original_url : size === "thumb" ? photo.thumb_url ?? photo.preview_url : photo.preview_url;
  if (!url || url.startsWith("pending:")) return new NextResponse(null, { status: 404 });

  const ifNoneMatch = request.headers.get("if-none-match") ?? undefined;
  const result = await getPrivateBlob(url, ifNoneMatch);
  if (!result) return new NextResponse(null, { status: 404 });
  if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers: { ETag: result.blob.etag, "Cache-Control": "private, max-age=3600" } });

  const contentType = result.headers.get("content-type") ?? (size === "full" ? "application/octet-stream" : "image/jpeg");
  const headers: Record<string, string> = { "Content-Type": contentType, "Cache-Control": "private, max-age=3600", ETag: result.blob.etag };
  if (size === "full") headers["Content-Disposition"] = `attachment; filename="${photo.filename.replace(/["\\]/g, "")}"`;
  return new NextResponse(result.stream as unknown as BodyInit, { status: 200, headers });
}
