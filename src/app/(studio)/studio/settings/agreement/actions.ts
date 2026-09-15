"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { db, one } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DEFAULT_AGREEMENT_MD, unknownAgreementVariables } from "@/lib/agreements";
import { str, type ActionState } from "@/lib/action-state";

const MAX_BODY = 40_000;

/**
 * Saves the agreement as a new version and makes it the active one (plan 11.13).
 * Earlier versions stay so a signed order can always show the exact wording
 * the client agreed to.
 */
export async function saveAgreementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio, user } = await requireWritableStudio("admin");
  const body = str(formData, "body_md", MAX_BODY).replace(/\r\n/g, "\n").trim();
  if (body.length < 40) return { error: "The agreement is too short to be useful.", fields: { body_md: "Write at least a few sentences." } };
  const unknown = unknownAgreementVariables(body);
  if (unknown.length > 0) {
    return { error: `Unknown variable${unknown.length > 1 ? "s" : ""}: ${unknown.map((v) => `{{${v}}}`).join(", ")}. Use one of the names listed on the right.`, fields: { body_md: "Fix the variable names." } };
  }
  const current = one<{ body_md: string; version: number }>(await db()`select body_md, version from agreement_templates where studio_id = ${studio.id} and is_active order by version desc limit 1`);
  if (current && current.body_md.trim() === body) return { ok: true, message: `No changes. Version ${current.version} stays active.` };
  const saved = one<{ version: number }>(
    await db()`
      with off as (update agreement_templates set is_active = false where studio_id = ${studio.id} and is_active)
      insert into agreement_templates (studio_id, version, body_md, is_active, created_by)
      select ${studio.id}, coalesce(max(version), 0) + 1, ${body}, true, ${user.id} from agreement_templates where studio_id = ${studio.id}
      returning version`
  );
  await audit({ studioId: studio.id, actorUserId: user.id, action: "agreement.saved", targetType: "agreement_template", metadata: { version: saved?.version ?? null } });
  revalidatePath("/studio/settings/agreement");
  return { ok: true, message: `Saved as version ${saved?.version ?? "?"}. New sessions use it from now on.` };
}

/** Restores the default wording as a new version. */
export async function resetAgreementAction(): Promise<void> {
  const { studio, user } = await requireWritableStudio("admin");
  const saved = one<{ version: number }>(
    await db()`
      with off as (update agreement_templates set is_active = false where studio_id = ${studio.id} and is_active)
      insert into agreement_templates (studio_id, version, body_md, is_active, created_by)
      select ${studio.id}, coalesce(max(version), 0) + 1, ${DEFAULT_AGREEMENT_MD}, true, ${user.id} from agreement_templates where studio_id = ${studio.id}
      returning version`
  );
  await audit({ studioId: studio.id, actorUserId: user.id, action: "agreement.reset", targetType: "agreement_template", metadata: { version: saved?.version ?? null } });
  revalidatePath("/studio/settings/agreement");
}

/** Makes an earlier version active again (as itself, not a copy). */
export async function activateAgreementVersionAction(formData: FormData) {
  const { studio, user } = await requireWritableStudio("admin");
  const version = Number(str(formData, "version", 10));
  if (!Number.isInteger(version) || version < 1) return;
  await db()`update agreement_templates set is_active = (version = ${version}) where studio_id = ${studio.id}`;
  await audit({ studioId: studio.id, actorUserId: user.id, action: "agreement.activated", targetType: "agreement_template", metadata: { version } });
  revalidatePath("/studio/settings/agreement");
}
