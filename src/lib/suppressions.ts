import "server-only";

import { db, rows } from "@/lib/db";

/**
 * Per-studio suppression list (plan 3.76, 16.6). An address here is never sent
 * studio mail. Hard bounces and complaints add entries automatically; the studio
 * can add and remove manual ones.
 */

export type SuppressionReason = "bounce" | "complaint" | "manual" | "unsubscribe";
export type Suppression = { email: string; reason: SuppressionReason; created_at: string };

export async function listSuppressions(studioId: string) {
  return rows<Suppression>(await db()`select email, reason, created_at::text from suppressions where studio_id = ${studioId} order by created_at desc`);
}

export async function addSuppression(studioId: string, email: string, reason: SuppressionReason) {
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return false;
  await db()`
    insert into suppressions (studio_id, email, reason) values (${studioId}, ${clean}, ${reason})
    on conflict (studio_id, email) do update set reason = excluded.reason`;
  return true;
}

export async function removeSuppression(studioId: string, email: string) {
  await db()`delete from suppressions where studio_id = ${studioId} and email = ${email.trim().toLowerCase()}`;
}
