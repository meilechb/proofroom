import "server-only";

import { hmac, safeEqual } from "@/lib/tokens";
import { requireEnv } from "@/lib/env";

/**
 * Signed, stateless links for client-facing pages (plan 13.18-13.20): the
 * client hub, unsubscribe, and printable invoice and receipt. The token carries
 * its kind, the id it grants, and an expiry, signed with APP_SECRET. No database
 * row, so nothing to clean up; re-requesting simply mints a fresh one.
 */

export type LinkKind = "hub" | "unsub" | "invoice" | "receipt" | "preview" | "download" | "license";

const DEFAULT_TTL_DAYS: Record<LinkKind, number> = { hub: 7, unsub: 365, invoice: 180, receipt: 3650, preview: 2, download: 3650, license: 3650 };

function secret() {
  return requireEnv("APP_SECRET");
}

export function signLink(kind: LinkKind, id: string, ttlDays = DEFAULT_TTL_DAYS[kind], now = Date.now()) {
  const exp = Math.floor(now / 1000) + ttlDays * 86400;
  const payload = `${kind}.${id}.${exp}`;
  return `${Buffer.from(payload).toString("base64url")}.${hmac(secret(), payload)}`;
}

export function verifyLink(kind: LinkKind, token: string | null | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const [k, id, expRaw] = payload.split(".");
  if (k !== kind || !id) return null;
  if (!safeEqual(hmac(secret(), payload), sig)) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(now / 1000)) return null;
  return id;
}
