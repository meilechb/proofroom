"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { voidReferral, reactivateReferral } from "@/lib/admin";
import { audit } from "@/lib/audit";

export async function voidReferralAction(id: string) {
  const user = await requirePlatformAdmin();
  await voidReferral(id, "voided by admin");
  await audit({ actorUserId: user.id, action: "admin.referral_voided", targetId: id });
  revalidatePath("/admin/referrals");
}

export async function reactivateReferralAction(id: string) {
  const user = await requirePlatformAdmin();
  await reactivateReferral(id);
  await audit({ actorUserId: user.id, action: "admin.referral_reactivated", targetId: id });
  revalidatePath("/admin/referrals");
}
