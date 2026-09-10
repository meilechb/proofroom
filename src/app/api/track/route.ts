import { NextResponse, type NextRequest } from "next/server";
import { db, isUuid, one } from "@/lib/db";
import { recordDownload, recordGalleryVisit, visitorHash } from "@/lib/analytics";

/** POST { galleryId, event: "view"|"download", photoId?, size? } from tenant pages (plan 13.23). Always 204. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { galleryId?: unknown; event?: unknown; photoId?: unknown; size?: unknown };
    if (typeof body.galleryId !== "string" || !isUuid(body.galleryId)) return new NextResponse(null, { status: 204 });
    const gallery = one<{ id: string; status: string }>(await db()`select id, status from galleries where id = ${body.galleryId}`);
    if (!gallery || gallery.status !== "published") return new NextResponse(null, { status: 204 });

    const visitor = visitorHash(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown", request.headers.get("user-agent") ?? "");
    if (body.event === "download") {
      const size = body.size === "full" ? "full" : "web";
      await recordDownload(gallery.id, typeof body.photoId === "string" && isUuid(body.photoId) ? body.photoId : null, "single", size, visitor);
    } else {
      await recordGalleryVisit(gallery.id, visitor);
    }
  } catch {
    // Analytics must never break the client.
  }
  return new NextResponse(null, { status: 204 });
}
