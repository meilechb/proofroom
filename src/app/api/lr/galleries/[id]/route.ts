import { withApi, ApiError } from "@/lib/lr-api";
import { db, one, isUuid } from "@/lib/db";
import { galleryUrl } from "@/lib/tenant";
import type { Gallery } from "@/lib/types";

/** GET /api/lr/galleries/[id] — one gallery with its link and access code (plan 18.4). */
export const GET = withApi(async ({ studio, params }) => {
  const id = params.id;
  if (!isUuid(id)) throw new ApiError(400, "invalid", "Bad gallery id.");
  const gallery = one<Gallery & { client_name: string | null }>(
    await db()`select g.*, c.name as client_name from galleries g join clients c on c.id = g.client_id where g.id = ${id} and g.studio_id = ${studio.id}`
  );
  if (!gallery) throw new ApiError(404, "not_found", "Gallery not found.");
  const count = one<{ n: number }>(await db()`select count(*)::int as n from photos where gallery_id = ${id} and deleted_at is null`);
  return {
    gallery: {
      id: gallery.id,
      title: gallery.title,
      kind: gallery.kind,
      status: gallery.status,
      slug: gallery.slug,
      access_code: gallery.access_code,
      url: galleryUrl(studio, gallery.slug),
      client: { name: gallery.client_name },
      photos: count?.n ?? 0,
    },
  };
});
