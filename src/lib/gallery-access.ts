import "server-only";

import { hashPassword, verifyPassword } from "@/lib/password";
import { limited } from "@/lib/rate-limit";
import type { Gallery, Order, Payment } from "@/lib/types";
import { orderMoney } from "@/lib/types";
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


/** Access codes stay short and readable; passwords and download PINs are hashed like passwords. */
export function hashGallerySecret(value: string) {
  return hashPassword(value.trim());
}

export function verifyGallerySecret(value: string, storedHash: string | null) {
  if (!storedHash) return false;
  return verifyPassword(value.trim(), storedHash);
}

export function verifyDownloadPin(pin: string, gallery: Pick<Gallery, "download_pin_hash">) {
  if (!gallery.download_pin_hash) return true; // no PIN set
  return verifyGallerySecret(pin, gallery.download_pin_hash);
}

/** How a visitor may unlock this gallery. */
export function unlockMethod(gallery: Pick<Gallery, "access_code" | "password_hash">): "code" | "password" | "open" {
  if (gallery.password_hash) return "password";
  if (gallery.access_code) return "code";
  return "open";
}

export function verifyUnlock(gallery: Pick<Gallery, "access_code" | "password_hash">, input: string) {
  const method = unlockMethod(gallery);
  if (method === "open") return true;
  if (method === "password") return verifyGallerySecret(input, gallery.password_hash);
  return verifyAccessCode(input, gallery.access_code);
}

/** Ten attempts per gallery per ip per 15 minutes (plan 3.51). */
export function unlockAttemptAllowed(galleryId: string, ip: string) {
  return limited("gallery_unlock", `${galleryId}:${ip}`);
}

export type GateState = "open" | "locked_unpaid" | "expired" | "closed";

/**
 * Whether full-size downloads are available (plan 3.50). Previews stay
 * viewable; only downloads are gated. Pay-gated finals unlock once the linked
 * order has no balance due.
 */
export function downloadGate(
  gallery: Pick<Gallery, "status" | "expires_at" | "allow_downloads" | "pay_gated">,
  order: Pick<Order, "amount_cents" | "deposit_cents" | "included_finals" | "extra_final_cents" | "discount_cents"> | null,
  payments: Pick<Payment, "amount_cents" | "status" | "refunded_cents">[],
  picks: number,
  now = new Date()
): GateState {
  if (gallery.status !== "published") return "closed";
  if (gallery.expires_at && new Date(gallery.expires_at) < now) return "expired";
  if (!gallery.allow_downloads) return "closed";
  if (gallery.pay_gated) {
    if (!order) return "locked_unpaid";
    if (!orderMoney(order, payments, picks).fully_paid) return "locked_unpaid";
  }
  return "open";
}

export function sharingAllowed(gallery: Pick<Gallery, "allow_sharing" | "status">) {
  return gallery.status === "published" && gallery.allow_sharing;
}
