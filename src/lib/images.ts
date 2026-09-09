import "server-only";

import { createHash } from "node:crypto";
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


/** Hex sha256 of the original bytes, used to spot duplicate uploads (plan 3.46). */
export function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Diagonal text watermark as an SVG tile. Pure so it can be unit tested; the
 * tile repeats across the image when composited (plan 3.44).
 */
export function watermarkSvg(text: string, opts: { size?: number; opacity?: number } = {}) {
  const size = opts.size ?? 360;
  const opacity = opts.opacity ?? 0.3;
  const safe = text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c] ?? c).slice(0, 60);
  const fontSize = Math.max(14, Math.round(size / Math.max(8, safe.length * 0.9)));
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" transform="rotate(-30 ${size / 2} ${size / 2})" ` +
      `font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="600" fill="white" fill-opacity="${opacity}" ` +
      `stroke="black" stroke-opacity="${opacity / 2}" stroke-width="1">${safe}</text></svg>`
  );
}

/**
 * Preview with a repeating watermark. Output is JPEG with metadata stripped
 * (sharp's default when withMetadata is not called), so EXIF, GPS and the
 * embedded thumbnail never reach the browser (plan 3.45). Originals are stored
 * untouched.
 */
export async function makeWatermarkedVersion(input: Buffer, maxEdge: number, text: string, quality = 86): Promise<WebVersion> {
  const base = await makeWebVersion(input, maxEdge, 100);
  const buffer = await sharp(base.buffer)
    .composite([{ input: watermarkSvg(text), tile: true, blend: "over", gravity: "centre" }])
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
  return { buffer, width: base.width, height: base.height };
}

/** Capture time from EXIF when present (plan 2.35 captured_at). */
export async function captureTime(input: Buffer): Promise<Date | null> {
  try {
    const meta = await sharp(input, { failOn: "none" }).metadata();
    const exif = meta.exif;
    if (!exif) return null;
    // DateTimeOriginal is stored as "YYYY:MM:DD HH:MM:SS" in the EXIF IFD.
    const m = exif.toString("latin1").match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
