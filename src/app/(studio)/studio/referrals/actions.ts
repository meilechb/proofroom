"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { ensureReferralCode, recordInvite } from "@/lib/referrals-server";
import { sendStudioEmail } from "@/lib/email";
import { REFERRAL_REWARD_TEXT } from "@/lib/referrals";
import { appUrl } from "@/lib/env";
import { str, type ActionState } from "@/lib/action-state";

/** Invite a photographer by email with the studio's referral link (plan 20.2). */
export async function inviteReferralAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio("admin");
  const email = str(formData, "email", 254);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email.", fields: { email: "Enter a valid email." } };
  const code = await ensureReferralCode(studio.id);
  const link = `${appUrl()}/signup?ref=${code}`;
  await recordInvite(studio.id, code, email);
  const res = await sendStudioEmail(studio, {
    to: email,
    subject: `${studio.name} thinks you'd like this`,
    text: `Hi,\n\n${studio.name} uses this to run client galleries, booking and payments, and invited you to try it. If you sign up with this link and start a subscription, you both get ${REFERRAL_REWARD_TEXT}.\n\n${link}\n\n— sent on behalf of ${studio.name}`,
    cta: { label: "Take a look", url: link },
    kind: "referral_invite",
  });
  revalidatePath("/studio/referrals");
  if (res.skipped) return { ok: true, message: `Saved. Email is not configured, so send your link to ${email} yourself.` };
  return res.ok ? { ok: true, message: `Invitation sent to ${email}.` } : { error: res.error || "Could not send the invitation." };
}
