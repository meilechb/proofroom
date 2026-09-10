import { withApi, ApiError, bodyString } from "@/lib/lr-api";
import { db, one, isUuid } from "@/lib/db";
import { reserveServerPhoto } from "@/lib/photos";
import { appUrl } from "@/lib/env";
import type { Gallery } from "@/lib/types";

/**
 * POST /api/lr/photos/begin (plan 18.5). Reserves a photo and returns the URL to
 * PUT the JPEG bytes to; the plugin uploads there and the server stores the file
 * and builds variants. A repeat sha256 in the gallery returns the existing id
 * (duplicate: true) and no upload URL.
 */
export const POST = withApi(async ({ studio, body }) => {
  const b = body as Record<string, unknown> | null;
  const galleryId = bodyString(body, "gallery_id", 64);
  if (!isUuid(galleryId)) throw new ApiError(400, "invalid", "Bad gallery id.");
  const gallery = one<Gallery>(await db()`select id from galleries where id = ${galleryId} and studio_id = ${studio.id}`);
  if (!gallery) throw new ApiError(404, "not_found", "Gallery not found.");

  const filename = bodyString(body, "filename", 200);
  const size = Number(b?.size);
  if (!Number.isFinite(size) || size <= 0) throw new ApiError(400, "invalid", "size must be a positive number.");
  const contentType = typeof b?.content_type === "string" ? b.content_type : "image/jpeg";
  const sha256 = typeof b?.sha256 === "string" ? b.sha256 : null;
  const lrPhotoId = typeof b?.lr_photo_id === "string" ? b.lr_photo_id.slice(0, 100) : null;

  let reserved;
  try {
    reserved = await reserveServerPhoto(studio.id, galleryId, { filename, size, contentType, sha256, lrPhotoId });
  } catch (error) {
    throw new ApiError(400, "invalid", error instanceof Error ? error.message : "Could not start the upload.");
  }
  return {
    photoId: reserved.photoId,
    duplicate: Boolean(reserved.duplicateOf),
    uploadUrl: reserved.duplicateOf ? null : `${appUrl()}/api/lr/photos/${reserved.photoId}/data`,
  };
}, { write: true });
