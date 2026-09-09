import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Opaque random token, URL-safe. 32 bytes = 256 bits. */
export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** Deterministic hash for storing tokens; tokens themselves are never stored. */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hmac(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Lightroom API tokens look like pr_live_<43 chars>; only the prefix is shown later. */
export function generateApiToken() {
  const token = `pr_live_${randomBytes(32).toString("base64url")}`;
  return { token, prefix: token.slice(0, 12), hash: hashToken(token) };
}
