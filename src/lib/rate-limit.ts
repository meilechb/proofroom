import "server-only";

import { db, dbConfigured } from "@/lib/db";

/**
 * Fixed-window rate limit stored in Postgres so it works across serverless
 * instances without another service. Windows are aligned to `windowSeconds`.
 * Returns { ok, remaining, retryAfterSeconds }.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number) {
  if (!dbConfigured()) return { ok: true, remaining: max, retryAfterSeconds: 0 };
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const rows = await db()`
    insert into rate_limits (key, window_start, count)
    values (${key}, ${windowStart.toISOString()}, 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count`;
  const count = Number((rows[0] as { count: number }).count);
  const retryAfterSeconds = Math.ceil((windowStart.getTime() + windowMs - now) / 1000);
  // Opportunistic cleanup of old windows (cheap, occasional).
  if (count === 1 && Math.random() < 0.05) {
    await db()`delete from rate_limits where window_start < now() - interval '1 day'`;
  }
  return { ok: count <= max, remaining: Math.max(0, max - count), retryAfterSeconds };
}

/** Best-effort client IP for keys and audit rows. */
export function clientIp(headers: Headers) {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

/**
 * Named limits so call sites do not invent numbers. Windows are seconds.
 *   login: per ip+email      signup: per ip       password_reset: per ip
 *   gallery_unlock: per gallery+ip   contact_form: per ip   api_token: per token
 *   slug_check: per ip       verify_resend: per user   pay_checkout: per order+ip
 */
export const LIMITS = {
  login: { max: 10, window: 15 * 60 },
  signup: { max: 5, window: 60 * 60 },
  password_reset: { max: 5, window: 60 * 60 },
  verify_resend: { max: 3, window: 60 * 60 },
  slug_check: { max: 60, window: 60 },
  gallery_unlock: { max: 10, window: 15 * 60 },
  contact_form: { max: 5, window: 60 * 60 },
  api_token: { max: 600, window: 60 },
  pay_checkout: { max: 10, window: 10 * 60 },
  booking: { max: 10, window: 60 * 60 },
  unsubscribe: { max: 20, window: 60 * 60 },
  store_checkout: { max: 15, window: 10 * 60 },
  store_download: { max: 60, window: 10 * 60 },
} as const;

export type LimitName = keyof typeof LIMITS;

/** rateLimit() with a preset: await limited("login", `${ip}:${email}`) */
export function limited(name: LimitName, subject: string) {
  const { max, window } = LIMITS[name];
  return rateLimit(`${name}:${subject}`, max, window);
}
