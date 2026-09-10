import "server-only";

import { db, one, rows } from "@/lib/db";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, PREVIEW_MAX_EDGE, THUMB_MAX_EDGE, captureTime, downloadBlob, makeWatermarkedVersion, makeWebVersion, putJpeg, sha256 } from "@/lib/images";
import { clientUploadToken, deleteMany, galleryPath, safeFilename, putPrivate } from "@/lib/storage";
import { addBytes, subtractBytes, assertUnderStorageCap } from "@/lib/usage";
import type { Gallery, Photo } from "@/lib/types";

/**
 * Photo lifecycle: begin (token for a browser or plugin direct upload),
 * complete (record, variants, usage), reorder, rename, soft delete, restore,
 * purge. Originals live in the private store and are streamed through
 * /api/photo/[id]; previews and thumbs are JPEGs with metadata stripped.
 */

export type UploadTicket = { photoId: string; pathname: string; token: string; duplicateOf: string | null };

/**
 * Reserve a photo row for a server-side upload (the Lightroom plugin PUTs the
 * bytes to our own endpoint). Mirrors beginUpload's validation and dedup but
 * mints no browser token. Returns the pathname to store the original at.
 */
export async function reserveServerPhoto(studioId: string, galleryId: string, input: { filename: string; size: number; contentType: string; sha256?: string | null; lrPhotoId?: string | null }): Promise<{ photoId: string; pathname: string; duplicateOf: string | null }> {
  if (input.size <= 0 || input.size > MAX_UPLOAD_BYTES) throw new Error(`Files must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
  if (!ALLOWED_IMAGE_TYPES.includes(input.contentType)) throw new Error("Only JPEG, PNG, WebP, TIFF and HEIC files are accepted.");
  const filename = safeFilename(input.filename, "photo.jpg");
  const duplicate = input.sha256
    ? one<{ id: string }>(await db()`select id from photos where gallery_id = ${galleryId} and sha256 = ${input.sha256} and deleted_at is null limit 1`)
    : null;
  if (duplicate) return { photoId: duplicate.id, pathname: "", duplicateOf: duplicate.id };
  const pathname = galleryPath(studioId, galleryId, `${Date.now()}-${filename}`);
  const nextOrder = one<{ n: number }>(await db()`select coalesce(max(sort_order), 0) + 1 as n from photos where gallery_id = ${galleryId}`);
  const photo = one<Photo>(
    await db()`
      insert into photos (studio_id, gallery_id, original_url, preview_url, filename, size_bytes, sort_order, sha256, lr_photo_id, uploaded_by)
      values (${studioId}, ${galleryId}, ${`pending:${pathname}`}, '', ${filename}, ${input.size}, ${nextOrder?.n ?? 1}, ${input.sha256 ?? null}, ${input.lrPhotoId ?? null}, 'studio')
      returning *`
  );
  if (!photo) throw new Error("Could not start the upload.");
  return { photoId: photo.id, pathname, duplicateOf: null };
}

/** Store the uploaded bytes and build variants (server-side upload path for the plugin). */
export async function ingestServerPhoto(studioId: string, photoId: string, buffer: Buffer, contentType: string, watermarkText: string | null) {
  const photo = one<Photo>(await db()`select * from photos where id = ${photoId} and studio_id = ${studioId} and deleted_at is null`);
  if (!photo) throw new Error("Photo not found.");
  const pending = photo.original_url.startsWith("pending:") ? photo.original_url.slice("pending:".length) : galleryPath(studioId, photo.gallery_id, `${photo.id}-original`);
  const originalBlob = await putPrivate(pending, buffer, contentType || "image/jpeg");
  const [preview, thumb, captured] = await Promise.all([
    watermarkText ? makeWatermarkedVersion(buffer, PREVIEW_MAX_EDGE, watermarkText) : makeWebVersion(buffer, PREVIEW_MAX_EDGE),
    makeWebVersion(buffer, THUMB_MAX_EDGE, 80),
    captureTime(buffer),
  ]);
  const previewBlob = await putJpeg("galleries", galleryPath(studioId, photo.gallery_id, `${photo.id}-preview.jpg`), preview.buffer);
  const thumbBlob = await putJpeg("galleries", galleryPath(studioId, photo.gallery_id, `${photo.id}-thumb.jpg`), thumb.buffer);
  const totalBytes = buffer.length + preview.buffer.length + thumb.buffer.length;
  const updated = one<Photo>(
    await db()`
      update photos set original_url = ${originalBlob.url}, preview_url = ${previewBlob.url}, thumb_url = ${thumbBlob.url},
        width = ${preview.width}, height = ${preview.height}, size_bytes = ${totalBytes}, sha256 = coalesce(sha256, ${sha256(buffer)}),
        captured_at = ${captured ? captured.toISOString() : null}
      where id = ${photoId} and studio_id = ${studioId} returning *`
  );
  await addBytes(studioId, totalBytes - photo.size_bytes);
  return updated;
}

export async function beginUpload(studioId: string, gallery: Pick<Gallery, "id">, input: { filename: string; size: number; contentType: string; sha256?: string | null; uploadedBy?: Photo["uploaded_by"] }): Promise<UploadTicket> {
  if (input.size <= 0 || input.size > MAX_UPLOAD_BYTES) throw new Error(`Files must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
  if (!ALLOWED_IMAGE_TYPES.includes(input.contentType)) throw new Error("Only JPEG, PNG, WebP, TIFF and HEIC files are accepted.");
  await assertUnderStorageCap(studioId);
  const filename = safeFilename(input.filename, "photo.jpg");
  const duplicate = input.sha256
    ? one<{ id: string }>(await db()`select id from photos where gallery_id = ${gallery.id} and sha256 = ${input.sha256} and deleted_at is null limit 1`)
    : null;
  const pathname = galleryPath(studioId, gallery.id, `${Date.now()}-${filename}`);
  const nextOrder = one<{ n: number }>(await db()`select coalesce(max(sort_order), 0) + 1 as n from photos where gallery_id = ${gallery.id}`);
  const photo = one<Photo>(
    await db()`
      insert into photos (studio_id, gallery_id, original_url, preview_url, filename, size_bytes, sort_order, sha256, uploaded_by)
      values (${studioId}, ${gallery.id}, ${`pending:${pathname}`}, '', ${filename}, ${input.size}, ${nextOrder?.n ?? 1}, ${input.sha256 ?? null}, ${input.uploadedBy ?? "studio"})
      returning *`
  );
  if (!photo) throw new Error("Could not start the upload.");
  const token = await clientUploadToken({ store: "galleries", pathname, maximumSizeInBytes: input.size + 1024, allowedContentTypes: [input.contentType] });
  return { photoId: photo.id, pathname, token, duplicateOf: duplicate?.id ?? null };
}

/** After the browser finished uploading: generate variants, record sizes, update usage. */
export async function completeUpload(studioId: string, photoId: string, originalUrl: string, watermarkText: string | null) {
  const photo = one<Photo>(await db()`select * from photos where id = ${photoId} and studio_id = ${studioId}`);
  if (!photo) throw new Error("Not found");
  const original = await downloadBlob(originalUrl, "galleries");
  const [preview, thumb, captured] = await Promise.all([
    watermarkText ? makeWatermarkedVersion(original, PREVIEW_MAX_EDGE, watermarkText) : makeWebVersion(original, PREVIEW_MAX_EDGE),
    makeWebVersion(original, THUMB_MAX_EDGE, 80),
    captureTime(original),
  ]);
  const base = originalUrl.split("?")[0].replace(/\.[a-z0-9]+$/i, "");
  const previewBlob = await putJpeg("galleries", `${basePath(base, photo)}-preview.jpg`, preview.buffer);
  const thumbBlob = await putJpeg("galleries", `${basePath(base, photo)}-thumb.jpg`, thumb.buffer);
  const totalBytes = original.length + preview.buffer.length + thumb.buffer.length;
  const updated = one<Photo>(
    await db()`
      update photos set original_url = ${originalUrl}, preview_url = ${previewBlob.url}, thumb_url = ${thumbBlob.url},
        width = ${preview.width}, height = ${preview.height}, size_bytes = ${totalBytes}, sha256 = coalesce(sha256, ${sha256(original)}),
        captured_at = ${captured ? captured.toISOString() : null}
      where id = ${photoId} returning *`
  );
  await addBytes(studioId, totalBytes - photo.size_bytes);
  return updated;
}

function basePath(_base: string, photo: Photo) {
  return galleryPath(photo.studio_id, photo.gallery_id, `${photo.id}`);
}

export async function listPhotos(studioId: string, galleryId: string, opts: { includeDeleted?: boolean } = {}) {
  return rows<Photo>(
    opts.includeDeleted
      ? await db()`select * from photos where gallery_id = ${galleryId} and studio_id = ${studioId} order by sort_order, created_at`
      : await db()`select * from photos where gallery_id = ${galleryId} and studio_id = ${studioId} and deleted_at is null order by sort_order, created_at`
  );
}

/** Applies a full ordering; ids not listed keep their relative order after the listed ones. */
export async function reorderPhotos(studioId: string, galleryId: string, orderedIds: string[]) {
  let position = 1;
  for (const id of orderedIds) {
    await db()`update photos set sort_order = ${position++} where id = ${id} and gallery_id = ${galleryId} and studio_id = ${studioId}`;
  }
  await db()`
    update photos set sort_order = sub.rn + ${orderedIds.length}
    from (select id, row_number() over (order by sort_order, created_at) as rn from photos where gallery_id = ${galleryId} and studio_id = ${studioId} and id <> all(${orderedIds}::uuid[])) sub
    where photos.id = sub.id`;
}

export async function renamePhoto(studioId: string, photoId: string, filename: string) {
  return one<Photo>(await db()`update photos set filename = ${safeFilename(filename, "photo.jpg")} where id = ${photoId} and studio_id = ${studioId} returning *`);
}

export async function softDeletePhotos(studioId: string, photoIds: string[]) {
  const deleted = await db()`update photos set deleted_at = now() where studio_id = ${studioId} and id = any(${photoIds}::uuid[]) and deleted_at is null returning id`;
  return deleted.length;
}

export async function restorePhotos(studioId: string, photoIds: string[]) {
  const restored = await db()`update photos set deleted_at = null where studio_id = ${studioId} and id = any(${photoIds}::uuid[]) returning id`;
  return restored.length;
}

export async function movePhoto(studioId: string, photoId: string, targetGalleryId: string) {
  const target = one<Gallery>(await db()`select * from galleries where id = ${targetGalleryId} and studio_id = ${studioId}`);
  if (!target) throw new Error("Target gallery not found");
  return one<Photo>(await db()`update photos set gallery_id = ${targetGalleryId} where id = ${photoId} and studio_id = ${studioId} returning *`);
}

/** Cron: removes blobs and rows for photos soft-deleted more than `days` ago. */
export async function purgeDeleted(days = 30) {
  const doomed = rows<Photo>(await db()`select * from photos where deleted_at is not null and deleted_at < now() - (${days} || ' days')::interval limit 500`);
  if (doomed.length === 0) return 0;
  await deleteMany("galleries", doomed.flatMap((p) => [p.original_url.startsWith("pending:") ? null : p.original_url, p.preview_url || null, p.thumb_url]));
  const byStudio = new Map<string, number>();
  for (const p of doomed) byStudio.set(p.studio_id, (byStudio.get(p.studio_id) ?? 0) + p.size_bytes);
  await db()`delete from photos where id = any(${doomed.map((p) => p.id)}::uuid[])`;
  for (const [studioId, bytes] of byStudio) await subtractBytes(studioId, bytes);
  return doomed.length;
}

/** Uploads that never completed (still pending after a day) are dropped. */
export async function dropStalePending(hours = 24) {
  const dropped = await db()`delete from photos where original_url like 'pending:%' and created_at < now() - (${hours} || ' hours')::interval returning id`;
  return dropped.length;
}
