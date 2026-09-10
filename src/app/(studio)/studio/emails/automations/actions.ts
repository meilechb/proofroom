"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { db } from "@/lib/db";
import { AUTOMATION_RULES, type AutomationSettings } from "@/lib/automations-shared";
import { bool, int, type ActionState } from "@/lib/action-state";

/** Save the per-rule enabled/delay settings and the pause switch (plan 16.7, 16.10). */
export async function saveAutomationsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio("admin");
  const automations = {} as AutomationSettings;
  for (const def of AUTOMATION_RULES) {
    automations[def.rule] = {
      enabled: bool(formData, `enabled_${def.rule}`),
      days: Math.min(60, Math.max(0, int(formData, `days_${def.rule}`, def.defaultDays))),
    };
  }
  const paused = bool(formData, "automations_paused");
  await db()`update studios set settings = settings || ${JSON.stringify({ automations, automations_paused: paused })}::jsonb where id = ${studio.id}`;
  revalidatePath("/studio/emails/automations");
  return { ok: true, message: "Saved." };
}
