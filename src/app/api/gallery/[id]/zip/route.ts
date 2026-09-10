import { type NextRequest } from "next/server";
import { db, one, rows } from "@/lib/db";
import { getPrivateBlob } from "@/lib/storage";
import { hasGalleryAccess, unlockMethod, downloadGate, verifyDownloadPin } from "@/lib/gallery-access";
import { listPayments } from "@/lib/payments";
import { getOrder } from "@/lib/orders";
import { zipStream, type ZipEntry } from "@/lib/zip";
import { recordDownload, visitorHash } from "@/lib/analytics";
import type { Gallery, Photo } from "@/lib/types";

/** GET /api/gallery/[id]/zip?size=web|full[&pin=] — streamed archive with access, PIN and pay-gate checks (plan 13.22). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const size = request.nextUrl.searchParams.get("size") === "full" ? "full" : "web";

  const gallery = one<Gallery>(await db()`select * from galleries where id = ${id}`);
  if (!gallery || gallery.status !== "published") return new Response("Not found", { status: 404 });

  const open = unlockMethod(gallery) === "open";
  if (!open && !(await hasGalleryAccess(gallery.id))) return new Response("Locked", { status: 403 });
  if (!verifyDownloadPin(request.nextUrl.searchParams.get("pin") ?? "", gallery)) return new Response("PIN required", { status: 401 });

  if (size === "full") {
    const order = gallery.order_id ? await getOrder(gallery.studio_id, gallery.order_id) : null;
    const payments = gallery.order_id ? await listPayments(gallery.order_id) : [];
    const picks = one<{ n: number }>(await db()`select count(*)::int as n from photo_selections where gallery_id = ${gallery.id} and selected`);
    if (downloadGate(gallery, order, payments, picks?.n ?? 0) !== "open") return new Response("Payment required", { status: 402 });
  } else if (!gallery.allow_downloads) {
    return new Response("Downloads are off", { status: 403 });
  }

  const photos = rows<Photo>(await db()`select * from photos where gallery_id = ${gallery.id} and deleted_at is null and preview_url <> '' order by sort_order, created_at`);
  if (photos.length === 0) return new Response("No photos", { status: 404 });

  const entries: ZipEntry[] = photos.map((p) => ({
    name: p.filename,
    read: async () => {
      const url = size === "full" ? p.original_url : p.preview_url;
      const blob = await getPrivateBlob(url);
      if (!blob || blob.statusCode !== 200) return new Uint8Array(0);
      return blob.stream;
    },
  }));

  const visitor = visitorHash(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown", request.headers.get("user-agent") ?? "");
  await recordDownload(gallery.id, null, "zip", size, visitor).catch(() => {});

  const safe = gallery.slug.replace(/[^a-z0-9-]/gi, "-");
  return new Response(zipStream(entries) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safe}-${size}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
