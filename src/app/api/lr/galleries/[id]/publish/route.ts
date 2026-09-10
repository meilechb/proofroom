import { withApi, ApiError } from "@/lib/lr-api";
import { db, one, isUuid } from "@/lib/db";
import { publishGallery } from "@/lib/galleries";

/** POST /api/lr/galleries/[id]/publish (plan 18.9). */
export const POST = withApi(async ({ studio, params }) => {
  const id = params.id;
  if (!isUuid(id)) throw new ApiError(400, "invalid", "Bad gallery id.");
  const gallery = one<{ id: string }>(await db()`select id from galleries where id = ${id} and studio_id = ${studio.id}`);
  if (!gallery) throw new ApiError(404, "not_found", "Gallery not found.");
  const updated = await publishGallery(studio.id, id);
  return { gallery: { id, status: updated?.status ?? "published", access_code: updated?.access_code ?? null } };
}, { write: true });
