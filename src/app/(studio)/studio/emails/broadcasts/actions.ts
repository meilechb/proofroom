"use server";

import { revalidatePath } from "next/cache";
import { requireEntitledStudio } from "@/lib/auth";
import { cancelBroadcast, createBroadcast, deleteBroadcast, getBroadcast, startBroadcast, updateBroadcast, type BroadcastAudience } from "@/lib/broadcasts";
import { broadcastSchema, fieldErrors } from "@/lib/validation";
import { str, type ActionState } from "@/lib/action-state";

const PATH = "/studio/emails/broadcasts";

export async function saveBroadcastAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio, user } = await requireEntitledStudio("automations", "admin");
  const parsed = broadcastSchema.safeParse({
    subject: str(formData, "subject", 200),
    body: str(formData, "body", 20000),
    audience: str(formData, "audience", 20) || "buyers",
  });
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const input = { subject: parsed.data.subject, body: parsed.data.body, audience: parsed.data.audience as BroadcastAudience };
  const id = str(formData, "id", 64);
  if (id) await updateBroadcast(studio.id, id, input);
  else await createBroadcast(studio.id, user.id, input);
  revalidatePath(PATH);
  return { ok: true, message: id ? "Draft saved." : "Draft created." };
}

/** Enqueue and send now (or schedule if a future time is given). */
export async function startBroadcastAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireEntitledStudio("automations", "admin");
  const id = str(formData, "id", 64);
  const b = await getBroadcast(studio.id, id);
  if (!b) return { error: "Not found." };
  const whenRaw = str(formData, "scheduledAt", 40);
  let scheduledAt: string | null = null;
  if (whenRaw) {
    const d = new Date(whenRaw);
    if (Number.isNaN(d.getTime())) return { error: "That schedule time isn't valid." };
    if (d.getTime() > Date.now() + 60_000) scheduledAt = d.toISOString(); // else send now
  }
  try {
    await startBroadcast(studio.id, id, { scheduledAt });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not start the broadcast." };
  }
  revalidatePath(PATH);
  return { ok: true, message: scheduledAt ? "Scheduled." : "Sending now — recipients receive it over the next few minutes." };
}

export async function cancelBroadcastAction(formData: FormData) {
  const { studio } = await requireEntitledStudio("automations", "admin");
  await cancelBroadcast(studio.id, str(formData, "id", 64));
  revalidatePath(PATH);
}

export async function deleteBroadcastAction(formData: FormData) {
  const { studio } = await requireEntitledStudio("automations", "admin");
  await deleteBroadcast(studio.id, str(formData, "id", 64));
  revalidatePath(PATH);
}
