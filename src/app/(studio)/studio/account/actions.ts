"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { applyEmailChange, checkCredentials, consumeAuthTokenWithMeta, findUserByEmail, issueAuthToken, setPassword, softDeleteUser, soleOwnedStudios, updateUserName } from "@/lib/account";
import { requireStudio, requireUser } from "@/lib/auth";
import { NOTIFICATION_KEYS, saveNotificationPrefs, type NotificationKey } from "@/lib/notifications";
import type { ActionState as NotifState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { sendPlatformEmail } from "@/lib/email";
import { APP_NAME, appUrl, supportEmail } from "@/lib/env";
import { passwordProblem } from "@/lib/password";
import { clientIp, limited } from "@/lib/rate-limit";
import { deleteSession, revokeAllSessions } from "@/lib/session";
import { emailSchema } from "@/lib/validation";
import { str, type ActionState } from "@/lib/action-state";

/** Account page actions (plan 5.17 to 5.21). */

export async function updateNameAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = str(formData, "name", 120);
  if (name.length < 1) return { error: "Enter your name.", fields: { name: "Enter your name." } };
  await updateUserName(user.id, name);
  revalidatePath("/studio/account");
  return { ok: true, message: "Name saved." };
}

/** Sends a confirmation link to the NEW address; the switch happens when it is clicked (plan 5.18). */
export async function requestEmailChangeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = emailSchema.safeParse(str(formData, "email", 254));
  if (!parsed.success) return { error: "Enter a valid email address.", fields: { email: "Enter a valid email address." } };
  const next = parsed.data;
  if (next === user.email.toLowerCase()) return { error: "That is already your email address." };
  const rl = await limited("password_reset", `email-change:${user.id}`);
  if (!rl.ok) return { error: "Too many requests. Try again later." };
  if (await findUserByEmail(next)) return { error: "That email is used by another account." };
  const token = await issueAuthToken(user.id, "change_email", { email: next });
  const url = `${appUrl()}/studio/account/confirm-email?token=${encodeURIComponent(token)}`;
  await sendPlatformEmail({
    to: next,
    kind: "change_email",
    subject: `Confirm your new email for ${APP_NAME}`,
    text: `Confirm that ${next} should be the email for your ${APP_NAME} account. The link is valid for 1 hour.\n\n${url}\n\nIf you did not ask for this, ignore this message.\n\n${APP_NAME}\n${supportEmail()}`,
    cta: { label: "Confirm new email", url },
  });
  return { ok: true, message: `We sent a confirmation link to ${next}. Your address changes once you click it.` };
}

/** Route /studio/account/confirm-email calls this with the token. */
export async function confirmEmailChange(token: string): Promise<{ ok: true } | { error: string }> {
  const consumed = await consumeAuthTokenWithMeta(token, "change_email");
  if (!consumed?.meta?.email) return { error: "This confirmation link is invalid or has expired." };
  const before = (await db()`select email from users where id = ${consumed.user_id}`)[0] as { email: string } | undefined;
  const result = await applyEmailChange(consumed.user_id, consumed.meta.email);
  if ("error" in result) return result;
  if (before?.email) {
    await sendPlatformEmail({
      to: before.email,
      kind: "email_changed",
      subject: `Your ${APP_NAME} email was changed`,
      text: `The email on your ${APP_NAME} account changed from ${before.email} to ${consumed.meta.email}. If this was not you, contact ${supportEmail()} right away.`,
    }).catch(() => undefined);
  }
  await audit({ actorUserId: consumed.user_id, action: "user.email_changed" });
  return { ok: true };
}

/** Requires the current password and signs out every other device (plan 5.19). */
export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const check = await checkCredentials(user.email, current);
  if ("error" in check) return { error: check.error === "locked" ? "Too many failed attempts. Try again later." : "Your current password is not right.", fields: { current: "Check your current password." } };
  if (password !== confirm) return { fields: { confirm: "The passwords do not match." }, error: "Please fix the highlighted fields." };
  const problem = passwordProblem(password, user.email);
  if (problem) return { fields: { password: problem }, error: "Please fix the highlighted fields." };
  await setPassword(user.id, password);
  await revokeAllSessions(user.id, user.session_id);
  await audit({ actorUserId: user.id, action: "user.password_changed", ip: clientIp(await headers()) });
  return { ok: true, message: "Password changed. Other devices were signed out." };
}

export async function revokeSessionAction(formData: FormData) {
  const user = await requireUser();
  const id = str(formData, "sessionId", 64);
  if (id === user.session_id) {
    await deleteSession();
    redirect("/login");
  }
  await db()`delete from sessions where id = ${id} and user_id = ${user.id}`;
  revalidatePath("/studio/account");
}

export async function revokeOtherSessionsAction() {
  const user = await requireUser();
  await revokeAllSessions(user.id, user.session_id);
  revalidatePath("/studio/account");
}

/** Blocked while the user is the only owner of a live studio (plan 5.21). */
export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const typed = str(formData, "confirm", 254).toLowerCase();
  if (typed !== user.email.toLowerCase()) return { error: "Type your email address exactly to confirm.", fields: { confirm: "Does not match." } };
  const sole = await soleOwnedStudios(user.id);
  if (sole.length > 0) {
    return { error: `You are the only owner of ${sole.map((s) => s.name).join(", ")}. Transfer ownership or delete the studio first (Settings → Data).` };
  }
  await audit({ actorUserId: user.id, action: "user.deleted" });
  await softDeleteUser(user.id);
  await deleteSession();
  redirect("/login?deleted=1");
}

/** Per-user notification preferences for the active studio (plan 17.5). */
export async function saveNotificationPrefsAction(_prev: NotifState, formData: FormData): Promise<NotifState> {
  const { studio, user } = await requireStudio();
  const prefs = {} as Record<NotificationKey, boolean>;
  for (const { key } of NOTIFICATION_KEYS) prefs[key] = formData.get(`notify_${key}`) === "on";
  await saveNotificationPrefs(user.id, studio.id, prefs);
  revalidatePath("/studio/account");
  return { ok: true, message: "Notification settings saved." };
}
