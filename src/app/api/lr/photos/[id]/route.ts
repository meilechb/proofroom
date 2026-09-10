import { withApi, ApiError } from "@/lib/lr-api";
import { db, one, isUuid } from "@/lib/db";
import { softDeletePhotos } from "@/lib/photos";
import { clientUploadToken, galleryPath, safeFilename } from "@/lib/storage";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/images";
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
 * order (plan 18.7). Returns a fresh upload token; the plugin uploads the new
 * bytes and calls /complete with the same photo_id.
 */
export const PATCH = withApi(async ({ studio, params, body }) => {
  const id = params.id;
  if (!isUuid(id)) throw new ApiError(400, "invalid", "Bad photo id.");
  const photo = one<Photo>(await db()`select * from photos where id = ${id} and studio_id = ${studio.id} and deleted_at is null`);
  if (!photo) throw new ApiError(404, "not_found", "Photo not found.");

  const b = body as Record<string, unknown> | null;
  const size = Number(b?.size);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) throw new ApiError(400, "invalid", "size must be a positive number within the limit.");
  const contentType = typeof b?.content_type === "string" && ALLOWED_IMAGE_TYPES.includes(b.content_type) ? b.content_type : "image/jpeg";
  const filename = safeFilename(typeof b?.filename === "string" ? b.filename : photo.filename, photo.filename);
  const pathname = galleryPath(studio.id, photo.gallery_id, `${Date.now()}-${filename}`);
  await db()`update photos set original_url = ${`pending:${pathname}`} where id = ${id} and studio_id = ${studio.id}`;
  const token = await clientUploadToken({ store: "galleries", pathname, maximumSizeInBytes: size + 1024, allowedContentTypes: [contentType] });
  return { photoId: id, pathname, token };
}, { write: true });
