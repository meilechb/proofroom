import { withApi, ApiError, bodyString } from "@/lib/lr-api";
import { db, one, isUuid } from "@/lib/db";
import { completeUpload } from "@/lib/photos";
import type { Gallery, Photo } from "@/lib/types";

/** POST /api/lr/photos/complete { photo_id, url } — generate variants (plan 18.6). */
export const POST = withApi(async ({ studio, body }) => {
  const photoId = bodyString(body, "photo_id", 64);
  const url = bodyString(body, "url", 1000);
  if (!isUuid(photoId)) throw new ApiError(400, "invalid", "Bad photo id.");
  const photo = one<Photo>(await db()`select * from photos where id = ${photoId} and studio_id = ${studio.id}`);
  if (!photo) throw new ApiError(404, "not_found", "Photo not found.");
  const gallery = one<Gallery>(await db()`select * from galleries where id = ${photo.gallery_id} and studio_id = ${studio.id}`);
  const updated = await completeUpload(studio.id, photoId, url, gallery?.watermark ? studio.name : null);
  return { photo: { id: photoId, width: updated?.width ?? null, height: updated?.height ?? null } };
}, { write: true });
