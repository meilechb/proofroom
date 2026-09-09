"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import {
  checkCredentials,
  consumeAuthToken,
  createStudioForUser,
  createUserWithStudio,
  findUserByEmail,
  issueAuthToken,
  markEmailVerified,
  setPassword,
  slugAvailable,
} from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";
import { db, one } from "@/lib/db";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/emails/account";
import { passwordProblem } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createSession, deleteSession, revokeAllSessions, setSessionStudio } from "@/lib/session";
import { normalizeSlug, studioSlugProblem } from "@/lib/slug";
import { hashToken } from "@/lib/tokens";
import { emailSchema, fieldErrors, loginSchema, signupSchema } from "@/lib/validation";
import { formValues, str, type ActionState } from "@/lib/action-state";
import { log } from "@/lib/logger";

function safeNext(next: string | null | undefined, fallback = "/studio") {
  return next && /^\/(?!\/)[\w\-/?=&%.]*$/.test(next) ? next : fallback;
}

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["name", "email", "studioName", "slug"]);
  const ip = clientIp(await headers());
  const rl = await rateLimit(`signup:${ip}`, 5, 3600);
  if (!rl.ok) return { error: "Too many sign-up attempts from this network. Try again in an hour.", values };

  const parsed = signupSchema.safeParse({
    name: str(formData, "name", 120),
    email: str(formData, "email", 254),
    password: String(formData.get("password") ?? ""),
    studioName: str(formData, "studioName", 120),
    slug: normalizeSlug(str(formData, "slug", 60) || str(formData, "studioName", 60)),
    terms: formData.get("terms") === "on",
  });
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error), values };
  const data = parsed.data;

  const pw = passwordProblem(data.password, data.email);
  if (pw) return { fields: { password: pw }, values, error: "Please fix the highlighted fields." };
  const slugIssue = studioSlugProblem(data.slug);
  if (slugIssue) return { fields: { slug: slugIssue }, values, error: "Please fix the highlighted fields." };

  if (await findUserByEmail(data.email)) {
    return { fields: { email: "An account with this email already exists. Sign in instead." }, values, error: "Please fix the highlighted fields." };
  }
  if (!(await slugAvailable(data.slug))) {
    return { fields: { slug: "That address is taken. Try another." }, values, error: "Please fix the highlighted fields." };
  }

  const { user, studio } = await createUserWithStudio(data);
  const token = await issueAuthToken(user.id, "verify_email");
  await sendVerificationEmail(user.email, user.name, token);
  await createSession(user.id, studio.id);
  await audit({ studioId: studio.id, actorUserId: user.id, action: "studio.created", targetType: "studio", targetId: studio.id, ip });
  log.info("signup", { studio: studio.slug });
  redirect("/studio?welcome=1");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["email"]);
  const ip = clientIp(await headers());
  const parsed = loginSchema.safeParse({ email: str(formData, "email", 254), password: String(formData.get("password") ?? "") });
  if (!parsed.success) return { error: "Enter your email and password.", values };
  const rl = await rateLimit(`login:${ip}:${parsed.data.email}`, 10, 900);
  if (!rl.ok) return { error: "Too many attempts. Wait 15 minutes and try again.", values };

  const result = await checkCredentials(parsed.data.email, parsed.data.password);
  if ("error" in result) {
    return {
      error:
        result.error === "locked"
          ? "This account is temporarily locked after too many failed attempts. Try again in 15 minutes or reset your password."
          : "That email and password do not match.",
      values,
    };
  }
  await createSession(result.user.id, null);
  await audit({ actorUserId: result.user.id, action: "user.login", ip });
  redirect(safeNext(str(formData, "next", 200)));
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ip = clientIp(await headers());
  const parsed = emailSchema.safeParse(str(formData, "email", 254));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const rl = await rateLimit(`forgot:${ip}`, 5, 3600);
  if (!rl.ok) return { error: "Too many requests. Try again later." };
  const user = await findUserByEmail(parsed.data);
  if (user) {
    const token = await issueAuthToken(user.id, "reset_password");
    await sendPasswordResetEmail(user.email, token);
  }
  // Same message either way: no account enumeration.
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = str(formData, "token", 200);
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) return { fields: { confirm: "The passwords do not match." }, error: "Please fix the highlighted fields." };
  const pw = passwordProblem(password);
  if (pw) return { fields: { password: pw }, error: "Please fix the highlighted fields." };
  const userId = await consumeAuthToken(token, "reset_password");
  if (!userId) return { error: "This reset link is invalid or has expired. Request a new one." };
  await setPassword(userId, password);
  await markEmailVerified(userId); // proving control of the inbox verifies it
  await revokeAllSessions(userId);
  await createSession(userId, null);
  await audit({ actorUserId: userId, action: "user.password_reset" });
  redirect("/studio?reset=1");
}

export async function resendVerificationAction(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  if (user.email_verified_at) return { ok: true, message: "Your email is already verified." };
  const rl = await rateLimit(`verify:${user.id}`, 3, 3600);
  if (!rl.ok) return { error: "You can request another link in an hour." };
  const token = await issueAuthToken(user.id, "verify_email");
  const sent = await sendVerificationEmail(user.email, user.name, token);
  if (sent.skipped) return { error: "Email is not configured on this deployment yet." };
  return { ok: true, message: `Verification email sent to ${user.email}.` };
}

const inviteSchema = z.object({ name: z.string().trim().min(1).max(120), password: z.string().min(1) });

export async function acceptInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = str(formData, "token", 200);
  const invite = one<{ id: string; studio_id: string; email: string; role: "admin" | "member" }>(
    await db()`select id, studio_id, email, role from invitations where token_hash = ${hashToken(token)} and accepted_at is null and expires_at > now() limit 1`
  );
  if (!invite) return { error: "This invitation is invalid or has expired." };

  let userId: string;
  const existing = await findUserByEmail(invite.email);
  const current = await getCurrentUser();
  if (current && current.email.toLowerCase() === invite.email.toLowerCase()) {
    userId = current.id;
  } else if (existing) {
    // Must sign in as that user first.
    const res = await checkCredentials(invite.email, String(formData.get("password") ?? ""));
    if ("error" in res) return { error: "Enter the password for the account with this email to accept." };
    userId = res.user.id;
  } else {
    const parsed = inviteSchema.safeParse({ name: str(formData, "name", 120), password: String(formData.get("password") ?? "") });
    if (!parsed.success) return { error: "Enter your name and choose a password." };
    const pw = passwordProblem(parsed.data.password, invite.email);
    if (pw) return { fields: { password: pw }, error: pw };
    const { hashPassword } = await import("@/lib/password");
    const created = one<{ id: string }>(
      await db()`insert into users (email, name, password_hash, email_verified_at) values (${invite.email}, ${parsed.data.name}, ${hashPassword(parsed.data.password)}, now()) returning id`
    );
    userId = created!.id;
  }
  await db()`insert into memberships (user_id, studio_id, role) values (${userId}, ${invite.studio_id}, ${invite.role}) on conflict (user_id, studio_id) do update set role = excluded.role`;
  await db()`update invitations set accepted_at = now() where id = ${invite.id}`;
  await audit({ studioId: invite.studio_id, actorUserId: userId, action: "member.joined", metadata: { role: invite.role } });
  if (!current) await createSession(userId, invite.studio_id);
  else await setSessionStudio(current.session_id, invite.studio_id);
  redirect("/studio");
}

export async function switchStudioAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const studioId = str(formData, "studioId", 64);
  const m = await db()`select 1 from memberships where user_id = ${user.id} and studio_id = ${studioId} limit 1`;
  if (m.length === 0) throw new Error("Not a member of that studio.");
  await setSessionStudio(user.session_id, studioId);
  redirect("/studio");
}

export async function createAdditionalStudioAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const studioName = str(formData, "studioName", 120);
  const slug = normalizeSlug(str(formData, "slug", 60) || studioName);
  if (studioName.length < 2) return { fields: { studioName: "Enter a studio name." }, error: "Please fix the highlighted fields." };
  const issue = studioSlugProblem(slug);
  if (issue) return { fields: { slug: issue }, error: issue };
  if (!(await slugAvailable(slug))) return { fields: { slug: "That address is taken." }, error: "That address is taken." };
  const studio = await createStudioForUser(user.id, { studioName, slug, email: user.email });
  await setSessionStudio(user.session_id, studio.id);
  await audit({ studioId: studio.id, actorUserId: user.id, action: "studio.created" });
  redirect("/studio?welcome=1");
}

/** GET /api/slug-check?slug= uses this. */
export async function checkSlug(slug: string) {
  const normalized = normalizeSlug(slug);
  const problem = studioSlugProblem(normalized);
  if (problem) return { slug: normalized, ok: false, message: problem };
  const available = await slugAvailable(normalized);
  return { slug: normalized, ok: available, message: available ? "Available" : "Taken" };
}
