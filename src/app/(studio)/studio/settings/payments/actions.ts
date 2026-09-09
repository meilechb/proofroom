"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireStudio } from "@/lib/auth";
import { disconnectAccount } from "@/lib/connect";
import { db } from "@/lib/db";
import { str, type ActionState } from "@/lib/action-state";

export async function disconnectStripeAction(): Promise<void> {
  const { studio, user } = await requireStudio("owner");
  await disconnectAccount(studio);
  await audit({ studioId: studio.id, actorUserId: user.id, action: "stripe.disconnected" });
  revalidatePath("/studio/settings/payments");
}

/** "I'll collect payment myself": instructions and an optional Payment Link (plan 7.10). */
export async function saveManualPaymentsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio, user } = await requireStudio("admin");
  const enabled = formData.get("manual") === "on";
  const instructions = str(formData, "instructions", 2000);
  const link = str(formData, "link", 300);
  if (link && !/^https:\/\/(buy\.stripe\.com|[a-z0-9.-]+)\/[^\s]*$/i.test(link)) return { error: "Enter a full https:// link.", fields: { link: "Enter a full https:// link." } };
  if (enabled && !instructions && !link) return { error: "Add instructions or a payment link so clients know how to pay.", fields: { instructions: "Required when collecting payment yourself." } };
  await db()`
    update studios set
      manual_payment_instructions = ${enabled ? instructions || null : null},
      manual_payment_link = ${enabled ? link || null : null},
      stripe_connect_method = case when ${enabled} and stripe_account_id is null then 'manual' when not ${enabled} and stripe_connect_method = 'manual' then 'none' else stripe_connect_method end
    where id = ${studio.id}`;
  await audit({ studioId: studio.id, actorUserId: user.id, action: enabled ? "payments.manual_enabled" : "payments.manual_disabled" });
  revalidatePath("/studio/settings/payments");
  return { ok: true, message: enabled ? "Saved. Clients see your instructions on the pay page." : "Saved." };
}
