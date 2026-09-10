"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireStudio } from "@/lib/auth";
import { setCustomDomain, checkCustomDomain, clearCustomDomain } from "@/lib/domains";
import { str, type ActionState } from "@/lib/action-state";

/** Enter a domain and register it with Vercel (plan 14.28). */
export async function saveDomainAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio, user } = await requireStudio("admin");
  const input = str(formData, "domain", 253);
  if (!input) return { error: "Enter your domain.", fields: { domain: "Enter your domain." } };
  try {
    const domain = await setCustomDomain(studio.id, input);
    await audit({ studioId: studio.id, actorUserId: user.id, action: "domain.set", metadata: { domain } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add that domain.";
    return { error: message, fields: { domain: message } };
  }
  revalidatePath("/studio/settings/domain");
  return { ok: true, message: "Saved. Add the DNS records below, then check again." };
}

/** Re-check DNS and ownership now (plan 14.29). */
export async function checkDomainAction(): Promise<void> {
  const { studio } = await requireStudio("admin");
  await checkCustomDomain(studio.id);
  revalidatePath("/studio/settings/domain");
}

/** Remove the domain (plan 14.30). */
export async function removeDomainAction(): Promise<void> {
  const { studio, user } = await requireStudio("admin");
  await clearCustomDomain(studio.id);
  await audit({ studioId: studio.id, actorUserId: user.id, action: "domain.removed" });
  revalidatePath("/studio/settings/domain");
}
