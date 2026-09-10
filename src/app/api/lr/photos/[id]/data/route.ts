import { withApi, ApiError } from "@/lib/lr-api";
import { db, one, isUuid } from "@/lib/db";
import { ingestServerPhoto } from "@/lib/photos";
import { MAX_UPLOAD_BYTES } from "@/lib/images";
import type { Gallery, Photo } from "@/lib/types";

export const maxDuration = 300;

/**
 * PUT /api/lr/photos/[id]/data (plan 18.6). The plugin uploads the rendered JPEG
 * bytes here; the server stores the original and builds web and thumb variants.
 */
export const PUT = withApi(async ({ studio, params, request }) => {
  const id = params.id;
  if (!isUuid(id)) throw new ApiError(400, "invalid", "Bad photo id.");
  const photo = one<Photo>(await db()`select * from photos where id = ${id} and studio_id = ${studio.id} and deleted_at is null`);
  if (!photo) throw new ApiError(404, "not_found", "Photo not found. Begin the upload first.");

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0) throw new ApiError(400, "invalid", "Empty upload.");
  if (bytes.length > MAX_UPLOAD_BYTES) throw new ApiError(413, "too_large", "File is too large.");

  const gallery = one<Gallery>(await db()`select * from galleries where id = ${photo.gallery_id} and studio_id = ${studio.id}`);
  const contentType = request.headers.get("content-type") || "image/jpeg";
  const updated = await ingestServerPhoto(studio.id, id, bytes, contentType, gallery?.watermark ? studio.name : null);
  return { photo: { id, width: updated?.width ?? null, height: updated?.height ?? null } };
}, { write: true });
