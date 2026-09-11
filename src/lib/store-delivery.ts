import "server-only";

import { db, one } from "@/lib/db";
import { assetById } from "@/lib/assets";
import { downloadBlob, makeWebVersion } from "@/lib/images";
import { getPrivateBlob, safeFilename } from "@/lib/storage";
import type { DownloadGrant, SaleItem } from "@/lib/types";

// Longest-edge sizes for the non-original tiers (standard ≈ an 8×10 at 300dpi).
const STORE_EDGE: Record<string, number> = { web: 1600, standard: 2560 };

export type GrantFile = { filename: string; contentType: string; body: Uint8Array | ReadableStream<Uint8Array>; bytes: number };

/**
 * The clean, purchased file for a grant + its sale item — shared by the single
 * download route and the "download all" ZIP. Never returns the watermarked
 * preview: `original` streams the source, `web`/`standard` are rendered clean
 * from the original on demand. Returns null when the source is missing.
 */
export async function resolveGrantFile(grant: Pick<DownloadGrant, "studio_id" | "resolution" | "file_id">, item: Pick<SaleItem, "asset_id" | "photo_id">): Promise<GrantFile | null> {
  if (grant.file_id) {
    // A digital product file: served byte-for-byte from the private store — no
    // rendering, no resolution tiers, no watermark.
    const file = one<{ url: string; filename: string; content_type: string | null }>(
      await db()`select url, filename, content_type from digital_files where id = ${grant.file_id} and studio_id = ${grant.studio_id}`
    );
    if (!file || file.url.startsWith("pending:")) return null;
    const result = await getPrivateBlob(file.url);
    if (!result || result.statusCode === 304) return null;
    return { filename: safeFilename(file.filename, "download"), contentType: file.content_type ?? result.headers.get("content-type") ?? "application/octet-stream", body: result.stream as ReadableStream<Uint8Array>, bytes: 0 };
  }
  if (item.asset_id) {
    const asset = await assetById(grant.studio_id, item.asset_id);
    if (!asset || asset.url.startsWith("pending:")) return null;
    const filename = safeFilename(asset.filename, "photo.jpg");
    if (grant.resolution === "original") {
      const res = await fetch(asset.url);
      if (!res.ok || !res.body) return null;
      return { filename, contentType: res.headers.get("content-type") ?? "image/jpeg", body: res.body, bytes: Number(res.headers.get("content-length") ?? 0) };
    }
    const rendered = (await makeWebVersion(await downloadBlob(asset.url, "assets"), STORE_EDGE[grant.resolution] ?? STORE_EDGE.standard)).buffer;
    return { filename: `${filename.replace(/\.[^.]+$/, "")}.jpg`, contentType: "image/jpeg", body: rendered, bytes: rendered.length };
  }
  if (item.photo_id) {
    const photo = one<{ original_url: string; filename: string }>(
      await db()`select original_url, filename from photos where id = ${item.photo_id} and studio_id = ${grant.studio_id} and deleted_at is null`
    );
    if (!photo || photo.original_url.startsWith("pending:")) return null;
    const filename = safeFilename(photo.filename, "photo.jpg");
    if (grant.resolution === "original") {
      const result = await getPrivateBlob(photo.original_url);
      if (!result || result.statusCode === 304) return null;
      return { filename, contentType: result.headers.get("content-type") ?? "application/octet-stream", body: result.stream as ReadableStream<Uint8Array>, bytes: 0 };
    }
    const rendered = (await makeWebVersion(await downloadBlob(photo.original_url, "galleries"), STORE_EDGE[grant.resolution] ?? STORE_EDGE.standard)).buffer;
    return { filename: `${filename.replace(/\.[^.]+$/, "")}.jpg`, contentType: "image/jpeg", body: rendered, bytes: rendered.length };
  }
  return null;
}
