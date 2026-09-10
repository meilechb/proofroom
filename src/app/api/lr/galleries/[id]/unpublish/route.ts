import { withApi, ApiError } from "@/lib/lr-api";
import { db, one, isUuid } from "@/lib/db";
import { unpublishGallery } from "@/lib/galleries";

/** POST /api/lr/galleries/[id]/unpublish (plan 18.9). */
export const POST = withApi(async ({ studio, params }) => {
  const id = params.id;
  if (!isUuid(id)) throw new ApiError(400, "invalid", "Bad gallery id.");
  const gallery = one<{ id: string }>(await db()`select id from galleries where id = ${id} and studio_id = ${studio.id}`);
  if (!gallery) throw new ApiError(404, "not_found", "Gallery not found.");
  await unpublishGallery(studio.id, id);
  return { gallery: { id, status: "draft" } };
}, { write: true });
