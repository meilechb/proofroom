"use server";

import { redirect } from "next/navigation";
import { requireStudio } from "@/lib/auth";
import { deleteStudio } from "@/lib/studio-lifecycle";
import { audit } from "@/lib/audit";
import { str, type ActionState } from "@/lib/action-state";

/** Delete the studio. Owner only, and the studio name must be typed to confirm (plan 17.7). */
export async function deleteStudioAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio, user } = await requireStudio("owner");
  const typed = str(formData, "confirm", 200);
  if (typed !== studio.name) return { error: "The name did not match. Type the studio name exactly to confirm.", fields: { confirm: "Does not match." } };
  await audit({ studioId: studio.id, actorUserId: user.id, action: "studio.deleted" });
  await deleteStudio(studio);
  redirect("/studio");
}
