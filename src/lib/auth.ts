import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { db, one, rows } from "@/lib/db";
import { readSession, setSessionStudio } from "@/lib/session";
import type { Membership, MembershipRole, Studio, User } from "@/lib/types";
import { billingState, entitlements, type BillingState, type Entitlements } from "@/lib/plans";

/**
 * Data Access Layer. Every page, server action and route handler that touches
 * studio data goes through requireStudio(); the proxy only does optimistic
 * redirects and is not a security boundary.
 */

export type CurrentUser = User & { session_id: string; session_studio_id: string | null };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = one<User>(
    await db()`select id, email, name, email_verified_at, is_platform_admin, created_at from users where id = ${session.user_id} limit 1`
  );
  if (!user) return null;
  return { ...user, session_id: session.id, session_studio_id: session.studio_id };
});

export const listMemberships = cache(async (userId: string) => {
  return rows<Membership & { studio: Studio }>(
    await db()`
      select m.*, row_to_json(s) as studio
      from memberships m join studios s on s.id = m.studio_id
      where m.user_id = ${userId} and s.deleted_at is null
      order by m.created_at asc`
  );
});

export type StudioContext = {
  user: CurrentUser;
  studio: Studio;
  role: MembershipRole;
  billing: BillingState;
  /** Feature limits for the studio's effective plan (Pro while trialing/active/past_due, else Free). */
  entitlements: Entitlements;
  impersonating?: boolean;
};

/** Entitlement keys that are simple on/off feature flags (excludes the numeric caps). */
export type FeatureFlag = { [K in keyof Entitlements]: Entitlements[K] extends boolean ? K : never }[keyof Entitlements];

const roleRank: Record<MembershipRole, number> = { member: 0, admin: 1, owner: 2 };

export function hasRole(role: MembershipRole, needed: MembershipRole) {
  return roleRank[role] >= roleRank[needed];
}

/**
 * Resolves the active studio for the signed-in user: the one stored on the
 * session, else the first membership (and remembers it). Returns null when the
 * user has no studio yet.
 */
export const getStudioContext = cache(async (): Promise<StudioContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  // Platform admins can view any studio read-only via a signed cookie (plan 19.4).
  if (user.is_platform_admin) {
    const { readImpersonation } = await import("@/lib/impersonation");
    const impId = await readImpersonation();
    if (impId) {
      const s = one<Studio>(await db()`select * from studios where id = ${impId}`);
      if (s) {
        const b = billingState(s);
        return { user, studio: normalizeStudio(s), role: "member", billing: { ...b, canWrite: false, publicLive: false }, entitlements: entitlements(b.effectivePlan), impersonating: true };
      }
    }
  }

  const memberships = await listMemberships(user.id);
  if (memberships.length === 0) return null;
  let m = memberships.find((x) => x.studio_id === user.session_studio_id) ?? memberships[0];
  if (m.studio_id !== user.session_studio_id) await setSessionStudio(user.session_id, m.studio_id);
  m = { ...m, studio: normalizeStudio(m.studio) };
  const billing = billingState(m.studio);
  return { user, studio: m.studio, role: m.role, billing, entitlements: entitlements(billing.effectivePlan) };
});

function normalizeStudio(s: Studio): Studio {
  // row_to_json keeps timestamps as strings already; make sure numbers are numbers.
  return { ...s, storage_bytes: Number(s.storage_bytes), next_order_number: Number(s.next_order_number) };
}

/** Pages: redirect to login (or to studio creation) when there is no context. */
export async function requireStudioPage(minRole: MembershipRole = "member"): Promise<StudioContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/studio");
  const ctx = await getStudioContext();
  if (!ctx) redirect("/signup?step=studio");
  if (!hasRole(ctx.role, minRole)) redirect("/studio?denied=1");
  if (ctx.studio.suspended_at && !user.is_platform_admin) redirect("/studio/suspended");
  return ctx;
}

/** Server actions and route handlers: throw instead of redirecting. */
export async function requireStudio(minRole: MembershipRole = "member"): Promise<StudioContext> {
  const ctx = await getStudioContext();
  if (!ctx) throw new Error("Unauthorized");
  if (!hasRole(ctx.role, minRole)) throw new Error("You do not have permission to do that.");
  if (ctx.studio.suspended_at) throw new Error("This studio is suspended.");
  return ctx;
}

/**
 * Mutations that create or change studio data: also rejects read-only studios
 * (trial ended, subscription ended). Read access stays available so the studio
 * can export, review and subscribe.
 */
export async function requireWritableStudio(minRole: MembershipRole = "member"): Promise<StudioContext> {
  const ctx = await requireStudio(minRole);
  if (!ctx.billing.canWrite) throw new ReadOnlyError(ctx.billing.status);
  return ctx;
}

export class ReadOnlyError extends Error {
  constructor(public status: string) {
    super("This studio can't be edited right now. Check Billing to continue.");
  }
}

/** Thrown when a studio tries to use a feature its plan does not include. The UI renders it as an upgrade prompt. */
export class UpgradeRequiredError extends Error {
  constructor(public feature: FeatureFlag) {
    super("That is a Pro feature. Upgrade to Pro in Billing to use it.");
  }
}

/** Rejects when the studio's effective plan does not include a feature flag. */
export function requireEntitlement(ctx: StudioContext, feature: FeatureFlag): StudioContext {
  if (!ctx.entitlements[feature]) throw new UpgradeRequiredError(feature);
  return ctx;
}

/** Writable + entitled: the common gate for a Pro-only server action. */
export async function requireEntitledStudio(feature: FeatureFlag, minRole: MembershipRole = "member"): Promise<StudioContext> {
  const ctx = await requireWritableStudio(minRole);
  return requireEntitlement(ctx, feature);
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requirePlatformAdminPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!user.is_platform_admin) redirect("/studio");
  return user;
}

export async function requirePlatformAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user?.is_platform_admin) throw new Error("Unauthorized");
  return user;
}

/** Ensures a row belongs to the studio; use before any mutation by id. */
export type OwnedTable =
  | "clients" | "inquiries" | "orders" | "payments" | "galleries" | "photos" | "packages" | "api_tokens"
  | "assets" | "portfolio_items" | "reviews" | "tasks" | "client_notes" | "documents" | "email_templates"
  | "agreement_templates" | "site_areas" | "broadcasts" | "imports" | "booking_slots" | "session_plans" | "referrals";

export async function assertOwned(table: OwnedTable, id: string, studioId: string) {
  if (!/^[a-z_]+$/.test(table)) throw new Error("Bad table");
  const found = await db().query(`select 1 from ${table} where id = $1 and studio_id = $2 limit 1`, [id, studioId]);
  if (found.length === 0) throw new Error("Not found");
}
