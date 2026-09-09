import "server-only";

import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { hmac } from "@/lib/tokens";

/**
 * Client galleries are protected by an access code rather than an account.
 * A successful check sets an HMAC-signed cookie scoped to that gallery so the
 * client is not asked again for 30 days. Cookies are host-scoped by the
 * browser, so a code entered on one studio's domain does not leak elsewhere.
 */

const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateAccessCode(length = 6) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function normalizeCode(code: string) {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

export function verifyAccessCode(code: string, stored: string | null) {
  if (!stored) return false;
  const a = Buffer.from(normalizeCode(code));
  const b = Buffer.from(normalizeCode(stored));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function secret() {
  const s = env.appSecret();
  if (!s || s.length < 32) throw new Error("APP_SECRET must be set (32+ characters).");
  return `gallery:${s}`;
}

function cookieName(galleryId: string) {
  return `pr_g_${galleryId.replace(/-/g, "")}`;
}

export async function grantGalleryAccess(galleryId: string) {
  const exp = Math.floor(Date.now() / 1000) + COOKIE_TTL_SECONDS;
  const payload = `${galleryId}.${exp}`;
  (await cookies()).set(cookieName(galleryId), `${payload}.${hmac(secret(), payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_TTL_SECONDS,
  });
}

export async function revokeGalleryAccess(galleryId: string) {
  (await cookies()).delete(cookieName(galleryId));
}

export async function hasGalleryAccess(galleryId: string) {
  const raw = (await cookies()).get(cookieName(galleryId))?.value;
  if (!raw) return false;
  const parts = raw.split(".");
  if (parts.length !== 3) return false;
  const [id, expStr, sig] = parts;
  if (id !== galleryId || Number(expStr) < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(hmac(secret(), `${id}.${expStr}`));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
