import "server-only";

import { db, one, rows } from "@/lib/db";
import { assetPath, clientUploadToken, deleteBlobs, safeFilename } from "@/lib/storage";
import { downloadBlob, makeWebVersion, putJpeg, sha256, PREVIEW_MAX_EDGE, THUMB_MAX_EDGE, MAX_UPLOAD_BYTES, ALLOWED_IMAGE_TYPES } from "@/lib/images";
import { addBytes } from "@/lib/usage";
import { isAssetFolder, type Asset, type AssetSort } from "@/lib/assets-shared";

/**
 * The studio asset library (plan 15). Assets live in the public Blob store so the
 * tenant site and app emails can serve them directly. Each image keeps three
 * sizes: the original (`url`), a 1600px web version and a 480px thumb. A `folder`
 * groups assets for filtering (site, portfolio, logo, reference); `tags` and
 * `alt` are free text. Types and the folder list live in assets-shared so client
 * components can import them.
 */

export type { Asset, AssetKind, AssetFolder, AssetSort } from "@/lib/assets-shared";
export { ASSET_FOLDERS } from "@/lib/assets-shared";

export function isReady(a: Pick<Asset, "url">) {
  return !a.url.startsWith("pending:");
}

/** The library list with search, folder filter and sort (plan 15.1). */
export async function listAssets(studioId: string, opts: { q?: string; folder?: string; sort?: AssetSort } = {}) {
  const like = opts.q?.trim() ? `%${opts.q.trim().toLowerCase()}%` : null;
  const folder = opts.folder && isAssetFolder(opts.folder) ? opts.folder : null;
  const sort: AssetSort = opts.sort === "name" || opts.sort === "largest" ? opts.sort : "recent";
  if (sort === "name") return rows<Asset>(await db()`select * from assets where studio_id = ${studioId} and url not like 'pending:%' and (${folder}::text is null or folder = ${folder}) and (${like}::text is null or lower(filename) like ${like} or lower(alt) like ${like} or lower(array_to_string(tags, ' ')) like ${like}) order by lower(filename) asc`);
  if (sort === "largest") return rows<Asset>(await db()`select * from assets where studio_id = ${studioId} and url not like 'pending:%' and (${folder}::text is null or folder = ${folder}) and (${like}::text is null or lower(filename) like ${like} or lower(alt) like ${like} or lower(array_to_string(tags, ' ')) like ${like}) order by size_bytes desc`);
  return rows<Asset>(await db()`select * from assets where studio_id = ${studioId} and url not like 'pending:%' and (${folder}::text is null or folder = ${folder}) and (${like}::text is null or lower(filename) like ${like} or lower(alt) like ${like} or lower(array_to_string(tags, ' ')) like ${like}) order by created_at desc`);
}

export async function assetById(studioId: string, id: string) {
  return one<Asset>(await db()`select * from assets where id = ${id} and studio_id = ${studioId}`);
}

export async function countAssets(studioId: string) {
  const r = one<{ n: number }>(await db()`select count(*)::int as n from assets where studio_id = ${studioId} and url not like 'pending:%'`);
  return r?.n ?? 0;
}

export type AssetUploadMeta = { filename: string; size: number; contentType: string };

/** Reserve an asset row and a public direct-upload token (plan 15.1.1, 15.4). */
export async function beginAssetUpload(studioId: string, userId: string | null, meta: AssetUploadMeta, folder?: string) {
  if (meta.size <= 0 || meta.size > MAX_UPLOAD_BYTES) throw new Error(`Files must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
  if (!ALLOWED_IMAGE_TYPES.includes(meta.contentType)) throw new Error("Only JPEG, PNG, WebP, TIFF and HEIC files are accepted.");
  const filename = safeFilename(meta.filename, "image.jpg");
  const pathname = assetPath(studioId, `${Date.now()}-${filename}`);
  const cleanFolder = folder && isAssetFolder(folder) ? folder : null;
  const asset = one<Asset>(
    await db()`
      insert into assets (studio_id, kind, url, filename, content_type, size_bytes, folder, created_by)
      values (${studioId}, 'image', ${`pending:${pathname}`}, ${filename}, ${meta.contentType}, ${meta.size}, ${cleanFolder}, ${userId})
      returning *`
  );
  if (!asset) throw new Error("Could not start the upload.");
  const token = await clientUploadToken({ store: "assets", pathname, maximumSizeInBytes: meta.size + 1024, allowedContentTypes: [meta.contentType] });
  return { assetId: asset.id, pathname, token };
}

/** After the bytes landed: build web and thumb versions and record dimensions and size (plan 15.4). */
export async function completeAssetUpload(studioId: string, assetId: string, originalUrl: string) {
  const asset = one<Asset>(await db()`select * from assets where id = ${assetId} and studio_id = ${studioId}`);
  if (!asset) throw new Error("Not found");
  const original = await downloadBlob(originalUrl, "assets");
  const [web, thumb] = await Promise.all([
    makeWebVersion(original, PREVIEW_MAX_EDGE),
    makeWebVersion(original, THUMB_MAX_EDGE, 80),
  ]);
  const webBlob = await putJpeg("assets", assetPath(studioId, `${asset.id}-web.jpg`), web.buffer);
  const thumbBlob = await putJpeg("assets", assetPath(studioId, `${asset.id}-thumb.jpg`), thumb.buffer);
  const totalBytes = original.length + web.buffer.length + thumb.buffer.length;
  const updated = one<Asset>(
    await db()`
      update assets set url = ${originalUrl}, web_url = ${webBlob.url}, thumb_url = ${thumbBlob.url},
        width = ${web.width}, height = ${web.height}, size_bytes = ${totalBytes}
      where id = ${assetId} and studio_id = ${studioId} returning *`
  );
  await addBytes(studioId, totalBytes - asset.size_bytes);
  return updated;
}

export async function updateAsset(studioId: string, id: string, patch: { alt?: string; tags?: string[]; folder?: string | null }) {
  const folder = patch.folder && isAssetFolder(patch.folder) ? patch.folder : patch.folder === null ? null : undefined;
  return one<Asset>(
    await db()`
      update assets set
        alt = coalesce(${patch.alt ?? null}, alt),
        tags = coalesce(${patch.tags ?? null}::text[], tags),
        folder = case when ${folder !== undefined} then ${folder ?? null} else folder end
      where id = ${id} and studio_id = ${studioId} returning *`
  );
}

/** Where an asset is used, so we can block deletion (plan 15.2). */
export async function assetUses(studioId: string, id: string): Promise<string[]> {
  const uses: string[] = [];
  const inPortfolio = one<{ n: number }>(await db()`select count(*)::int as n from portfolio_items where asset_id = ${id} and studio_id = ${studioId}`);
  if ((inPortfolio?.n ?? 0) > 0) uses.push("Portfolio");
  const studio = one<{ site: unknown; site_draft: unknown }>(await db()`select site, site_draft from studios where id = ${studioId}`);
  if (studio) {
    // Logo, favicon and section images are all stored by id inside the site JSON.
    const haystack = `${JSON.stringify(studio.site ?? "")}${JSON.stringify(studio.site_draft ?? "")}`;
    if (haystack.includes(id)) uses.push("Website");
  }
  return [...new Set(uses)];
}

/** Delete an asset and its blobs; refuse when it is in use (plan 15.2). */
export async function deleteAsset(studioId: string, id: string) {
  const asset = await assetById(studioId, id);
  if (!asset) return { deleted: false, uses: [] as string[] };
  const uses = await assetUses(studioId, id);
  if (uses.length) return { deleted: false, uses };
  await deleteBlobs("assets", [asset.url, asset.web_url, asset.thumb_url]);
  await db()`delete from assets where id = ${id} and studio_id = ${studioId}`;
  await addBytes(studioId, -asset.size_bytes);
  return { deleted: true, uses: [] as string[] };
}

export async function bulkUpdateFolder(studioId: string, ids: string[], folder: string | null) {
  if (!ids.length) return 0;
  const clean = folder && isAssetFolder(folder) ? folder : null;
  const updated = await db()`update assets set folder = ${clean} where studio_id = ${studioId} and id = any(${ids}::uuid[]) returning id`;
  return updated.length;
}

/** Delete several assets, skipping any that are in use; returns what happened (plan 15.3). */
export async function bulkDeleteAssets(studioId: string, ids: string[]) {
  let deleted = 0;
  const blocked: string[] = [];
  for (const id of ids) {
    const res = await deleteAsset(studioId, id);
    if (res.deleted) deleted++;
    else blocked.push(id);
  }
  return { deleted, blocked };
}

/** Verify sha256 is available for callers that dedupe by content (kept for parity with photos). */
export function contentHash(buffer: Buffer) {
  return sha256(buffer);
}
