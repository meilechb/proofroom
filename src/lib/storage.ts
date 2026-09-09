import "server-only";

import { del, get, head, put } from "@vercel/blob";
import { env } from "@/lib/env";

/**
 * Vercel Blob. Two stores:
 *   galleries (private): client photos, streamed through /api/photo/[id]
 *   assets    (public):  studio logos, served directly
 * Every gallery path is prefixed with the studio id so usage can be audited.
 */
export type Store = "galleries" | "assets";

export function blobToken(store: Store) {
  const v = store === "galleries" ? env.blobToken() : env.assetsBlobToken();
  if (!v) {
    throw new Error(
      store === "galleries"
        ? "BLOB_READ_WRITE_TOKEN is not set (private galleries store)."
        : "ASSETS_READ_WRITE_TOKEN is not set (public assets store)."
    );
  }
  return v;
}

export function storageConfigured() {
  return Boolean(env.blobToken());
}

export function galleryPath(studioId: string, galleryId: string, file: string) {
  return `studios/${studioId}/galleries/${galleryId}/${file}`;
}

export function assetPath(studioId: string, file: string) {
  return `studios/${studioId}/assets/${file}`;
}

export function getPrivateBlob(url: string, ifNoneMatch?: string) {
  return get(url, { access: "private", token: blobToken("galleries"), ifNoneMatch });
}

export async function headBlob(pathname: string) {
  return head(pathname, { token: blobToken("galleries") });
}

export async function putPublic(pathname: string, body: Buffer, contentType: string) {
  return put(pathname, body, {
    access: "public",
    token: blobToken("assets"),
    contentType,
    addRandomSuffix: true,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
}

/** Best-effort delete; a missing blob must not block deleting the database row. */
export async function deleteBlobs(store: Store, urls: Array<string | null | undefined>) {
  const list = urls.filter((u): u is string => Boolean(u));
  if (list.length === 0) return;
  try {
    await del(list, { token: blobToken(store) });
  } catch (error) {
    console.error(`Failed to delete ${list.length} blob(s) from ${store}:`, error);
  }
}

export const PUBLIC_BLOB_HOST_PATTERN = "*.public.blob.vercel-storage.com";

/**
 * Browser direct uploads (plan 3.41). The server issues a short-lived client
 * token bound to one pathname, a size cap and allowed content types; the
 * browser uploads straight to Blob with @vercel/blob/client `put`, and the
 * server records the file when the client reports completion.
 */
export const UPLOAD_TOKEN_TTL_MS = 30 * 60 * 1000;

export async function clientUploadToken(input: { store: Store; pathname: string; maximumSizeInBytes: number; allowedContentTypes: string[] }) {
  const { generateClientTokenFromReadWriteToken } = await import("@vercel/blob/client");
  return generateClientTokenFromReadWriteToken({
    token: blobToken(input.store),
    pathname: input.pathname,
    maximumSizeInBytes: input.maximumSizeInBytes,
    allowedContentTypes: input.allowedContentTypes,
    validUntil: Date.now() + UPLOAD_TOKEN_TTL_MS,
    addRandomSuffix: true,
  });
}

/** Deletes in batches with one retry each; returns how many URLs were requested (plan 3.42). */
export async function deleteMany(store: Store, urls: Array<string | null | undefined>, batchSize = 100) {
  const list = urls.filter((u): u is string => Boolean(u));
  for (let i = 0; i < list.length; i += batchSize) {
    const batch = list.slice(i, i + batchSize);
    try {
      await del(batch, { token: blobToken(store) });
    } catch {
      await new Promise((r) => setTimeout(r, 500));
      await deleteBlobs(store, batch);
    }
  }
  return list.length;
}

/** Keeps only safe characters in a filename and caps its length; never returns an empty name. */
export function safeFilename(name: string, fallback = "file") {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120);
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : fallback;
}
