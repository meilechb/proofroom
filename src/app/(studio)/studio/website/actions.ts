"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireWritableStudio } from "@/lib/auth";
import { db, one } from "@/lib/db";
import { defaultSite } from "@/lib/site/defaults";
import { parseSite, siteSchema, type Site } from "@/lib/site/schema";
import { validateForPublish } from "@/lib/site/publish";
import { str, type ActionState } from "@/lib/action-state";

function currentDraft(row: { site: Record<string, unknown>; site_draft: Record<string, unknown> | null; name: string }): Site {
  const published = parseSite(row.site, defaultSite(row.name));
  return row.site_draft ? parseSite(row.site_draft, published) : published;
}

async function loadRow(studioId: string) {
  return one<{ site: Record<string, unknown>; site_draft: Record<string, unknown> | null; name: string }>(
    await db()`select site, site_draft, name from studios where id = ${studioId}`
  );
}

/** Merge a partial patch (produced by the editor form) into the draft and save it. */
export async function saveDraftAction(patch: Partial<Site>): Promise<{ ok: boolean; error?: string }> {
  const { studio } = await requireWritableStudio("admin");
  const row = await loadRow(studio.id);
  if (!row) return { ok: false, error: "Studio not found." };
  const merged = deepMerge(currentDraft(row) as unknown as Record<string, unknown>, patch as Record<string, unknown>);
  const parsed = siteSchema.safeParse(merged);
  if (!parsed.success) return { ok: false, error: "Some values were not valid." };
  await db()`update studios set site_draft = ${JSON.stringify(parsed.data)}::jsonb where id = ${studio.id}`;
  revalidatePath("/studio/website");
  revalidatePath("/studio/website/preview");
  return { ok: true };
}

export async function publishSiteAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  void _formData;
  const { studio, user } = await requireWritableStudio("admin");
  const row = await loadRow(studio.id);
  if (!row) return { error: "Studio not found." };
  const draft = currentDraft(row);
  const result = validateForPublish(draft);
  if (!result.ok) return { error: "Please fix these before publishing:", fields: Object.fromEntries(result.issues.map((i) => [i.path, i.message])) };
  await db()`update studios set site = ${JSON.stringify(result.site)}::jsonb, site_draft = null, site_published_at = now(), site_template = ${result.site.settings.template} where id = ${studio.id}`;
  await audit({ studioId: studio.id, actorUserId: user.id, action: "site.published" });
  revalidatePath("/studio/website");
  return { ok: true, message: "Your website is live." };
}

export async function discardDraftAction() {
  const { studio } = await requireWritableStudio("admin");
  await db()`update studios set site_draft = null where id = ${studio.id}`;
  revalidatePath("/studio/website");
  revalidatePath("/studio/website/preview");
}

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = Array.isArray(base) ? [...(base as unknown[])] as unknown as Record<string, unknown> : { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
      out[k] = deepMerge(base[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}
