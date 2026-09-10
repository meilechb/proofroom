import "server-only";

import { db, one, rows, withTx } from "@/lib/db";
import { randomToken, hashToken } from "@/lib/tokens";
import type { MembershipRole } from "@/lib/types";

/**
 * Studio team management (plan 17.4). Owners and admins invite teammates; the
 * owner is unique and can only change through an explicit transfer. Invitations
 * are consumed by the existing /invite/[token] flow.
 */

export type Member = { user_id: string; name: string; email: string; role: MembershipRole; last_login_at: string | null; created_at: string };
export type PendingInvite = { id: string; email: string; role: "admin" | "member"; expires_at: string; created_at: string };

const INVITE_TTL_DAYS = 7;

export async function listMembers(studioId: string) {
  return rows<Member>(
    await db()`
      select u.id as user_id, u.name, u.email, m.role, u.last_login_at::text, m.created_at::text
      from memberships m join users u on u.id = m.user_id
      where m.studio_id = ${studioId}
      order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, lower(u.name), lower(u.email)`
  );
}

export async function listPendingInvites(studioId: string) {
  return rows<PendingInvite>(
    await db()`select id, email, role, expires_at::text, created_at::text from invitations where studio_id = ${studioId} and accepted_at is null and expires_at > now() order by created_at desc`
  );
}

/** Create an invitation; returns the raw token so the caller can email the link. */
export async function inviteMember(studioId: string, invitedBy: string | null, email: string, role: "admin" | "member") {
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) throw new Error("Enter a valid email address.");
  if (role !== "admin" && role !== "member") throw new Error("Choose a role.");
  const already = one<{ role: string }>(await db()`select m.role from memberships m join users u on u.id = m.user_id where m.studio_id = ${studioId} and lower(u.email) = ${clean}`);
  if (already) throw new Error("That person is already on your team.");
  // One live invite per email: drop any prior pending one.
  await db()`delete from invitations where studio_id = ${studioId} and lower(email) = ${clean} and accepted_at is null`;
  const token = randomToken();
  await db()`
    insert into invitations (studio_id, email, role, token_hash, invited_by, expires_at)
    values (${studioId}, ${clean}, ${role}, ${hashToken(token)}, ${invitedBy}, now() + ${`${INVITE_TTL_DAYS} days`}::interval)`;
  return token;
}

/** Regenerate an invite's token and extend it; returns { email, token } to re-send. */
export async function resendInvite(studioId: string, inviteId: string) {
  const invite = one<{ email: string }>(await db()`select email from invitations where id = ${inviteId} and studio_id = ${studioId} and accepted_at is null`);
  if (!invite) throw new Error("That invitation is no longer pending.");
  const token = randomToken();
  await db()`update invitations set token_hash = ${hashToken(token)}, expires_at = now() + ${`${INVITE_TTL_DAYS} days`}::interval, created_at = now() where id = ${inviteId} and studio_id = ${studioId}`;
  return { email: invite.email, token };
}

export async function revokeInvite(studioId: string, inviteId: string) {
  await db()`delete from invitations where id = ${inviteId} and studio_id = ${studioId} and accepted_at is null`;
}

/** Change a member's role. The owner's role is never changed here (use transfer). */
export async function changeMemberRole(studioId: string, userId: string, role: "admin" | "member") {
  if (role !== "admin" && role !== "member") throw new Error("Choose a role.");
  const target = one<{ role: string }>(await db()`select role from memberships where studio_id = ${studioId} and user_id = ${userId}`);
  if (!target) throw new Error("Not a member.");
  if (target.role === "owner") throw new Error("Transfer ownership to change the owner's role.");
  await db()`update memberships set role = ${role} where studio_id = ${studioId} and user_id = ${userId}`;
}

/** Remove a member. The owner cannot be removed. */
export async function removeMember(studioId: string, userId: string) {
  const target = one<{ role: string }>(await db()`select role from memberships where studio_id = ${studioId} and user_id = ${userId}`);
  if (!target) return;
  if (target.role === "owner") throw new Error("The owner cannot be removed. Transfer ownership first.");
  await db()`delete from memberships where studio_id = ${studioId} and user_id = ${userId}`;
}

/** Transfer ownership: the new owner becomes 'owner', the old owner becomes 'admin'. */
export async function transferOwnership(studioId: string, currentOwnerId: string, newOwnerUserId: string) {
  if (currentOwnerId === newOwnerUserId) return;
  const target = one<{ role: string }>(await db()`select role from memberships where studio_id = ${studioId} and user_id = ${newOwnerUserId}`);
  if (!target) throw new Error("That person is not on your team.");
  await withTx((sql) => [
    sql`update memberships set role = 'admin' where studio_id = ${studioId} and user_id = ${currentOwnerId}`,
    sql`update memberships set role = 'owner' where studio_id = ${studioId} and user_id = ${newOwnerUserId}`,
  ]);
}
