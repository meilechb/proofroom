import "server-only";

import { db, one } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { hashToken, randomToken } from "@/lib/tokens";
import { TRIAL_DAYS } from "@/lib/plans";
import { generateReferralCode } from "@/lib/referrals";
import { DEFAULT_AGREEMENT_MD } from "@/lib/agreements";
import { defaultSite } from "@/lib/site/defaults";
import type { Studio, User } from "@/lib/types";

/** Account-level operations: users, studios, one-time tokens, lockout. */

const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;

export async function findUserByEmail(email: string) {
  return one<User & { password_hash: string | null; failed_logins: number; locked_until: string | null }>(
    await db()`select * from users where lower(email) = lower(${email}) limit 1`
  );
}

export async function slugAvailable(slug: string) {
  const row = await db()`select 1 from studios where slug = ${slug} limit 1`;
  return row.length === 0;
}

/** Default packages so a new studio has something to book against immediately. */
const DEFAULT_PACKAGES = [
  { slug: "individual", name: "Individual headshot", description: "One person, one look. 30 minutes in the studio.", price: 25000, deposit: 10000, included: 2, extra: 5000, includes: ["30-minute session", "Online proof gallery", "2 retouched images", "Web and print files"], turnaround: "2 to 3 business days", featured: true },
  { slug: "professional", name: "Professional", description: "Two looks and more final images.", price: 40000, deposit: 15000, included: 5, extra: 4000, includes: ["60-minute session", "Two outfit changes", "5 retouched images", "Web and print files"], turnaround: "3 to 5 business days", featured: false },
  { slug: "team", name: "Team session", description: "On-site headshots for a team. Priced per person.", price: 15000, deposit: 0, included: 1, extra: 5000, includes: ["On-site setup", "10 minutes per person", "1 retouched image per person", "Consistent background and lighting"], turnaround: "5 business days", featured: false },
];

export async function createUserWithStudio(input: {
  name: string;
  email: string;
  password: string;
  studioName: string;
  slug: string;
  timezone?: string | null;
}): Promise<{ user: User; studio: Studio }> {
  const passwordHash = hashPassword(input.password);
  const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();
  const user = one<User>(
    await db()`
      insert into users (email, name, password_hash)
      values (${input.email}, ${input.name}, ${passwordHash})
      returning id, email, name, email_verified_at, is_platform_admin, created_at`
  );
  if (!user) throw new Error("Could not create the account.");
  const studio = one<Studio>(
    await db()`
      insert into studios (slug, name, legal_name, email, trial_ends_at, onboarding, timezone)
      values (${input.slug}, ${input.studioName}, ${input.studioName}, ${input.email}, ${trialEnds}, '{}'::jsonb, ${validTimezone(input.timezone) ?? "America/New_York"})
      returning *`
  );
  if (!studio) throw new Error("Could not create the studio.");
  await db()`insert into memberships (user_id, studio_id, role) values (${user.id}, ${studio.id}, 'owner')`;
  await seedStudioDefaults(studio.id);
  return { user, studio };
}

export async function createStudioForUser(userId: string, input: { studioName: string; slug: string; email: string }) {
  const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();
  const studio = one<Studio>(
    await db()`
      insert into studios (slug, name, legal_name, email, trial_ends_at)
      values (${input.slug}, ${input.studioName}, ${input.studioName}, ${input.email}, ${trialEnds})
      returning *`
  );
  if (!studio) throw new Error("Could not create the studio.");
  await db()`insert into memberships (user_id, studio_id, role) values (${userId}, ${studio.id}, 'owner')`;
  await seedStudioDefaults(studio.id);
  return studio;
}

/** Defaults every new studio gets: packages, a referral code, agreement v1. Safe to re-run. */
export async function seedStudioDefaults(studioId: string) {
  await ensureReferralCode(studioId);
  const studio = one<{ name: string; site: Record<string, unknown> }>(await db()`select name, site from studios where id = ${studioId}`);
  if (studio && Object.keys(studio.site ?? {}).length === 0) {
    await db()`update studios set site = ${JSON.stringify(defaultSite(studio.name))}::jsonb where id = ${studioId}`;
  }
  await db()`
    insert into agreement_templates (studio_id, version, body_md, is_active)
    values (${studioId}, 1, ${DEFAULT_AGREEMENT_MD}, true)
    on conflict (studio_id, version) do nothing`;
  let order = 0;
  for (const p of DEFAULT_PACKAGES) {
    await db()`
      insert into packages (studio_id, slug, name, description, price_cents, deposit_cents, included_finals, extra_final_cents, includes, turnaround, is_featured, sort_order)
      values (${studioId}, ${p.slug}, ${p.name}, ${p.description}, ${p.price}, ${p.deposit}, ${p.included}, ${p.extra}, ${p.includes}, ${p.turnaround}, ${p.featured}, ${order++})
      on conflict (studio_id, slug) do nothing`;
  }
}

/** IANA zone names only; anything else falls back to the default. */
export function validTimezone(tz: string | null | undefined) {
  if (!tz || tz.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/** Returns the user on success, or a reason (with the lock end when locked). Applies lockout after repeated failures. */
export async function checkCredentials(email: string, password: string): Promise<{ user: User } | { error: "invalid" | "locked"; lockedUntil?: string | null }> {
  const user = await findUserByEmail(email);
  if (!user) {
    // Burn similar time to a real check so timing does not reveal existence.
    verifyPassword(password, "scrypt:32768:8:1:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    return { error: "invalid" };
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) return { error: "locked", lockedUntil: user.locked_until };
  if (!verifyPassword(password, user.password_hash)) {
    const failed = (user.failed_logins ?? 0) + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await db()`
      update users set failed_logins = ${lock ? 0 : failed},
        locked_until = ${lock ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null}
      where id = ${user.id}`;
    return lock ? { error: "locked", lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() } : { error: "invalid" };
  }
  await db()`update users set failed_logins = 0, locked_until = null, last_login_at = now() where id = ${user.id}`;
  const { password_hash: _ph, failed_logins: _fl, locked_until: _lu, ...safe } = user;
  void _ph; void _fl; void _lu;
  return { user: safe };
}

export type TokenKind = "verify_email" | "reset_password" | "magic_link" | "change_email";

const TOKEN_TTL_MINUTES: Record<TokenKind, number> = { verify_email: 24 * 60, reset_password: 60, magic_link: 15, change_email: 60 };

/** Creates a single-use token, invalidating earlier unused tokens of the same kind. */
export async function issueAuthToken(userId: string, kind: TokenKind, meta: Record<string, string> = {}) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + TOKEN_TTL_MINUTES[kind] * 60000).toISOString();
  await db()`update auth_tokens set used_at = now() where user_id = ${userId} and kind = ${kind} and used_at is null`;
  await db()`insert into auth_tokens (kind, user_id, token_hash, expires_at, meta) values (${kind}, ${userId}, ${hashToken(token)}, ${expires}, ${JSON.stringify(meta)}::jsonb)`;
  return token;
}

/** Consumes a token; returns the user id or null when invalid, expired or already used. */
export async function consumeAuthToken(token: string, kind: TokenKind): Promise<string | null> {
  return (await consumeAuthTokenWithMeta(token, kind))?.user_id ?? null;
}

export async function consumeAuthTokenWithMeta(token: string, kind: TokenKind): Promise<{ user_id: string; meta: Record<string, string> } | null> {
  if (!token || token.length > 200) return null;
  return one<{ user_id: string; meta: Record<string, string> }>(
    await db()`
      update auth_tokens set used_at = now()
      where token_hash = ${hashToken(token)} and kind = ${kind} and used_at is null and expires_at > now()
      returning user_id, meta`
  );
}

/** Applies a verified email change; fails if another account took the address meanwhile. */
export async function applyEmailChange(userId: string, newEmail: string) {
  const taken = await findUserByEmail(newEmail);
  if (taken && taken.id !== userId) return { error: "That email is now used by another account." } as const;
  await db()`update users set email = ${newEmail.toLowerCase()}, email_verified_at = now(), updated_at = now() where id = ${userId}`;
  return { ok: true } as const;
}

export async function updateUserName(userId: string, name: string) {
  await db()`update users set name = ${name.trim()}, updated_at = now() where id = ${userId}`;
}

/** Sole ownership of any live studio blocks account deletion (plan 5.21). */
export async function soleOwnedStudios(userId: string) {
  return (await db()`
    select s.name from memberships m join studios s on s.id = m.studio_id
    where m.user_id = ${userId} and m.role = 'owner' and s.deleted_at is null
      and not exists (select 1 from memberships m2 where m2.studio_id = m.studio_id and m2.role = 'owner' and m2.user_id <> ${userId})`) as { name: string }[];
}

export async function softDeleteUser(userId: string) {
  const anon = `deleted+${userId}@deleted.invalid`;
  await db()`delete from memberships where user_id = ${userId}`;
  await db()`delete from sessions where user_id = ${userId}`;
  await db()`update users set email = ${anon}, name = 'Deleted account', password_hash = null, updated_at = now() where id = ${userId}`;
}

export async function markEmailVerified(userId: string) {
  await db()`update users set email_verified_at = coalesce(email_verified_at, now()), updated_at = now() where id = ${userId}`;
}

export async function setPassword(userId: string, password: string) {
  await db()`update users set password_hash = ${hashPassword(password)}, failed_logins = 0, locked_until = null, updated_at = now() where id = ${userId}`;
}

/** Assigns a unique referral code if the studio does not have one yet. */
export async function ensureReferralCode(studioId: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const updated = await db()`
      update studios set referral_code = ${code}
      where id = ${studioId} and referral_code is null
        and not exists (select 1 from studios s2 where s2.referral_code = ${code})
      returning referral_code`;
    if (updated.length > 0) return (updated[0] as { referral_code: string }).referral_code;
    const existing = one<{ referral_code: string | null }>(await db()`select referral_code from studios where id = ${studioId}`);
    if (existing?.referral_code) return existing.referral_code;
  }
  throw new Error("Could not assign a referral code.");
}
