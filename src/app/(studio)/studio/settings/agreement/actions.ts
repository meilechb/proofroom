"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { saveAgreement } from "@/lib/agreement-data";
import { unknownAgreementVariables } from "@/lib/agreements";
import type { ActionState } from "@/lib/action-state";

/** Saves the studio's client agreement as a new active version (plan 2.31). */
export async function saveAgreementAction(bodyMd: string): Promise<ActionState> {
  const { studio, user } = await requireWritableStudio("admin");
  const body = (bodyMd ?? "").trim();
  if (body.length < 20) return { error: "The agreement is too short — write the terms clients will sign." };
  if (body.length > 50000) return { error: "That agreement is too long." };
  const unknown = unknownAgreementVariables(body);
  if (unknown.length) return { error: `Unknown variable${unknown.length > 1 ? "s" : ""}: ${unknown.map((u) => `{{${u}}}`).join(", ")}. Remove or fix before saving.` };
  const { version } = await saveAgreement(studio.id, body, user.id);
  revalidatePath("/studio/settings/agreement");
  return { ok: true, message: `Saved as version ${version}. New sessions use it; already-signed sessions keep theirs.` };
}
