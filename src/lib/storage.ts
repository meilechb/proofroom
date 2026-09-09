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
