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
