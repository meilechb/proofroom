import "server-only";

import { db, one } from "@/lib/db";
import { resolveTemplate, templatesByKey, type TemplateKey, type TemplateValues } from "@/lib/email-templates";

/** Reads and writes a studio's email template overrides (plan 16.1, 16.2). */

export type TemplateOverride = { key: TemplateKey; subject: string; body: string; cta_label: string | null; updated_at: string };

export async function listTemplateOverrides(studioId: string) {
  const rows = (await db()`select key, subject, body, cta_label, updated_at::text from email_templates where studio_id = ${studioId}`) as TemplateOverride[];
  return new Map(rows.map((r) => [r.key, r]));
}

/** The effective values for a key: the studio override, else the default. */
export async function getTemplate(studioId: string, key: TemplateKey): Promise<{ values: TemplateValues; customized: boolean; updatedAt: string | null }> {
  const row = one<TemplateOverride>(await db()`select key, subject, body, cta_label, updated_at::text from email_templates where studio_id = ${studioId} and key = ${key}`);
  const values = resolveTemplate(key, row ? { subject: row.subject, body: row.body, cta_label: row.cta_label ?? undefined } : null);
  return { values, customized: Boolean(row), updatedAt: row?.updated_at ?? null };
}

export async function saveTemplate(studioId: string, key: TemplateKey, values: TemplateValues) {
  const def = templatesByKey[key];
  const cta = def.hasCta ? values.cta_label?.trim() || null : null;
  await db()`
    insert into email_templates (studio_id, key, subject, body, cta_label, updated_at)
    values (${studioId}, ${key}, ${values.subject.trim()}, ${values.body.trim()}, ${cta}, now())
    on conflict (studio_id, key) do update set subject = excluded.subject, body = excluded.body, cta_label = excluded.cta_label, updated_at = now()`;
}

/** Reset to the built-in default by removing the override row (plan 16.2.5). */
export async function resetTemplate(studioId: string, key: TemplateKey) {
  await db()`delete from email_templates where studio_id = ${studioId} and key = ${key}`;
}
