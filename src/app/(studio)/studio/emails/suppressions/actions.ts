"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { addSuppression, removeSuppression } from "@/lib/suppressions";
import { str, type ActionState } from "@/lib/action-state";

export async function addSuppressionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio("admin");
  const email = str(formData, "email", 254);
  const ok = await addSuppression(studio.id, email, "manual");
  if (!ok) return { error: "Enter a valid email address.", fields: { email: "Enter a valid email address." } };
  revalidatePath("/studio/emails/suppressions");
  return { ok: true, message: `${email} will no longer receive your emails.` };
}

export async function removeSuppressionAction(formData: FormData): Promise<void> {
  const { studio } = await requireWritableStudio("admin");
  await removeSuppression(studio.id, str(formData, "email", 254));
  revalidatePath("/studio/emails/suppressions");
}
