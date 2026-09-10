import { withApi, ApiError, bodyString } from "@/lib/lr-api";
import { db, one, isUuid } from "@/lib/db";
import { beginUpload } from "@/lib/photos";
import type { Gallery } from "@/lib/types";

/**
 * POST /api/lr/photos/begin (plan 18.5). Reserves a photo and returns a
 * direct-upload token; the plugin uploads the bytes to Blob and then calls
 * /complete. A repeat sha256 in the gallery returns the existing id (dedup).
 */
export const POST = withApi(async ({ studio, body }) => {
  const b = body as Record<string, unknown> | null;
  const galleryId = bodyString(body, "gallery_id", 64);
  if (!isUuid(galleryId)) throw new ApiError(400, "invalid", "Bad gallery id.");
  const gallery = one<Gallery>(await db()`select * from galleries where id = ${galleryId} and studio_id = ${studio.id}`);
  if (!gallery) throw new ApiError(404, "not_found", "Gallery not found.");

  const filename = bodyString(body, "filename", 200);
  const size = Number(b?.size);
  if (!Number.isFinite(size) || size <= 0) throw new ApiError(400, "invalid", "size must be a positive number.");
  const contentType = typeof b?.content_type === "string" ? b.content_type : "image/jpeg";
  const sha256 = typeof b?.sha256 === "string" ? b.sha256 : null;
  const lrPhotoId = typeof b?.lr_photo_id === "string" ? b.lr_photo_id.slice(0, 100) : null;

  let ticket;
  try {
    ticket = await beginUpload(studio.id, { id: gallery.id }, { filename, size, contentType, sha256 });
  } catch (error) {
    throw new ApiError(400, "invalid", error instanceof Error ? error.message : "Could not start the upload.");
  }
  if (lrPhotoId && !ticket.duplicateOf) await db()`update photos set lr_photo_id = ${lrPhotoId} where id = ${ticket.photoId} and studio_id = ${studio.id}`;

  return { photoId: ticket.duplicateOf ?? ticket.photoId, pathname: ticket.pathname, token: ticket.token, duplicate: Boolean(ticket.duplicateOf) };
}, { write: true });
