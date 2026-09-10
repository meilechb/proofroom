"use server";

import { revalidatePath } from "next/cache";
import { requireStudio, requireWritableStudio } from "@/lib/auth";
import { inviteMember, resendInvite, revokeInvite, changeMemberRole, removeMember, transferOwnership, seatUsage } from "@/lib/team";
import { syncSeatQuantity } from "@/lib/billing";
import { sendInviteEmail } from "@/lib/emails/account";
import { audit } from "@/lib/audit";
import { str, type ActionState } from "@/lib/action-state";

export async function inviteMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio, user, entitlements } = await requireWritableStudio("admin");
  const email = str(formData, "email", 254);
  const role = str(formData, "role", 10) === "admin" ? "admin" : "member";
  if (entitlements.maxSeats !== null && (await seatUsage(studio.id)) >= entitlements.maxSeats) {
    const msg = `The Free plan includes ${entitlements.maxSeats} seat${entitlements.maxSeats === 1 ? "" : "s"}. Upgrade to Pro to add teammates.`;
    return { error: msg, upgrade: { feature: "seats" } };
  }
  try {
    const token = await inviteMember(studio.id, user.id, email, role);
    await sendInviteEmail(email, studio.name, user.name || studio.name, token);
    await audit({ studioId: studio.id, actorUserId: user.id, action: "team.invited", metadata: { email, role } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send the invitation.";
    return { error: message, fields: { email: message } };
  }
  revalidatePath("/studio/settings/team");
  return { ok: true, message: `Invitation sent to ${email}.` };
}

export async function resendInviteAction(inviteId: string): Promise<void> {
  const { studio, user } = await requireWritableStudio("admin");
  const { email, token } = await resendInvite(studio.id, inviteId);
  await sendInviteEmail(email, studio.name, user.name || studio.name, token);
  revalidatePath("/studio/settings/team");
}

export async function revokeInviteAction(inviteId: string): Promise<void> {
  const { studio } = await requireWritableStudio("admin");
  await revokeInvite(studio.id, inviteId);
  revalidatePath("/studio/settings/team");
}

export async function changeRoleAction(userId: string, role: "admin" | "member"): Promise<ActionState> {
  const { studio, user } = await requireWritableStudio("admin");
  try {
    await changeMemberRole(studio.id, userId, role);
    await audit({ studioId: studio.id, actorUserId: user.id, action: "team.role_changed", targetId: userId, metadata: { role } });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not change the role." };
  }
  revalidatePath("/studio/settings/team");
  return { ok: true };
}

export async function removeMemberAction(userId: string): Promise<ActionState> {
  const { studio, user } = await requireWritableStudio("admin");
  if (userId === user.id) return { error: "You cannot remove yourself." };
  try {
    await removeMember(studio.id, userId);
    await audit({ studioId: studio.id, actorUserId: user.id, action: "team.removed", targetId: userId });
    await syncSeatQuantity(studio);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not remove the member." };
  }
  revalidatePath("/studio/settings/team");
  return { ok: true };
}

/** Only the owner can transfer ownership (plan 17.4.6). */
export async function transferOwnershipAction(newOwnerUserId: string): Promise<ActionState> {
  const { studio, user } = await requireStudio("owner");
  try {
    await transferOwnership(studio.id, user.id, newOwnerUserId);
    await audit({ studioId: studio.id, actorUserId: user.id, action: "team.ownership_transferred", targetId: newOwnerUserId });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not transfer ownership." };
  }
  revalidatePath("/studio/settings/team");
  return { ok: true, message: "Ownership transferred." };
}
