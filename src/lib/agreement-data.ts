import "server-only";

import { db, one } from "@/lib/db";

/**
 * Database access for per-studio agreement templates. Kept out of
 * lib/agreements.ts (which is client-safe: renderAgreement runs in the pay
 * page) so the server-only queries don't leak into a client bundle.
 *
 * Templates are versioned and orders store the version they were signed under,
 * so saving a new version never rewrites what a past client already agreed to.
 */

export type AgreementTemplate = { id: string; version: number; body_md: string; is_active: boolean; created_at: string };

export async function activeAgreement(studioId: string): Promise<AgreementTemplate | null> {
  return one<AgreementTemplate>(
    await db()`
      select id, version, body_md, is_active, created_at from agreement_templates
      where studio_id = ${studioId} and is_active order by version desc limit 1`
  );
}

/** Saves the edited body as a new active version and deactivates the previous ones. */
export async function saveAgreement(studioId: string, bodyMd: string, userId: string | null): Promise<{ id: string; version: number }> {
  const cur = one<{ v: number }>(await db()`select coalesce(max(version), 0) as v from agreement_templates where studio_id = ${studioId}`);
  const version = (cur?.v ?? 0) + 1;
  await db()`update agreement_templates set is_active = false where studio_id = ${studioId} and is_active`;
  const created = one<{ id: string; version: number }>(
    await db()`
      insert into agreement_templates (studio_id, version, body_md, is_active, created_by)
      values (${studioId}, ${version}, ${bodyMd}, true, ${userId})
      returning id, version`
  );
  return created ?? { id: "", version };
}
