import "server-only";

import sharp from "sharp";
import { get, put } from "@vercel/blob";
import { blobToken, type Store } from "@/lib/storage";

export const PREVIEW_MAX_EDGE = 1600;
export const THUMB_MAX_EDGE = 480;
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/tiff", "image/heic"];

export async function downloadBlob(url: string, store: Store): Promise<Buffer> {
  const result = await get(url, {
    access: store === "galleries" ? "private" : "public",
    token: blobToken(store),
    useCache: false,
  });
  if (!result || result.statusCode !== 200) throw new Error("Uploaded file not found in storage");
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

export type WebVersion = { buffer: Buffer; width: number | null; height: number | null };

/** Applies EXIF orientation, scales so the longest edge is at most maxEdge, returns JPEG. */
export async function makeWebVersion(input: Buffer, maxEdge: number, quality = 86): Promise<WebVersion> {
  const image = sharp(input, { failOn: "none" }).rotate();
  const meta = await image.metadata();
  const buffer = await image
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
  const swap = (meta.orientation ?? 1) >= 5;
  return {
    buffer,
    width: swap ? (meta.height ?? null) : (meta.width ?? null),
    height: swap ? (meta.width ?? null) : (meta.height ?? null),
  };
}

/** Square-ish logo normalization for studio branding (max 512px, keeps transparency as PNG). */
export async function makeLogo(input: Buffer): Promise<{ buffer: Buffer; contentType: string }> {
  const image = sharp(input, { failOn: "none" }).rotate().resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true });
  const meta = await sharp(input).metadata();
  if (meta.hasAlpha) return { buffer: await image.png().toBuffer(), contentType: "image/png" };
  return { buffer: await image.jpeg({ quality: 90 }).toBuffer(), contentType: "image/jpeg" };
}

export async function putJpeg(store: Store, pathname: string, buffer: Buffer) {
  return put(pathname, buffer, {
    access: store === "galleries" ? "private" : "public",
    token: blobToken(store),
    contentType: "image/jpeg",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
}

export function describeImageError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/unsupported image format|Input buffer contains unsupported/i.test(message)) {
    return "This file type can't be processed. Export as JPEG, PNG or WebP and try again.";
  }
  return message;
}
