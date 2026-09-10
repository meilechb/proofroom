import { withApi, ApiError } from "@/lib/lr-api";
import { db, one, isUuid } from "@/lib/db";
import { softDeletePhotos } from "@/lib/photos";
import { galleryPath, safeFilename } from "@/lib/storage";
import { appUrl } from "@/lib/env";
import type { Photo } from "@/lib/types";

/** DELETE /api/lr/photos/[id] — remove a photo (plan 18.7). */
export const DELETE = withApi(async ({ studio, params }) => {
  const id = params.id;
  if (!isUuid(id)) throw new ApiError(400, "invalid", "Bad photo id.");
  await softDeletePhotos(studio.id, [id]);
  return { ok: true };
}, { write: true });

/**
 * PATCH /api/lr/photos/[id] — replace the file in place, keeping the id and
 * order (plan 18.7). Marks the photo pending and returns the upload URL; the
 * plugin PUTs the new bytes there.
 */
export const PATCH = withApi(async ({ studio, params, body }) => {
  const id = params.id;
  if (!isUuid(id)) throw new ApiError(400, "invalid", "Bad photo id.");
  const photo = one<Photo>(await db()`select * from photos where id = ${id} and studio_id = ${studio.id} and deleted_at is null`);
  if (!photo) throw new ApiError(404, "not_found", "Photo not found.");

  const b = body as Record<string, unknown> | null;
  const filename = safeFilename(typeof b?.filename === "string" ? b.filename : photo.filename, photo.filename);
  const pathname = galleryPath(studio.id, photo.gallery_id, `${Date.now()}-${filename}`);
  await db()`update photos set original_url = ${`pending:${pathname}`} where id = ${id} and studio_id = ${studio.id}`;
  return { photoId: id, uploadUrl: `${appUrl()}/api/lr/photos/${id}/data` };
}, { write: true });
