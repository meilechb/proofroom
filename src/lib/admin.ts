import "server-only";

import { db, one, rows } from "@/lib/db";
import { billingState } from "@/lib/plans";
import type { Studio } from "@/lib/types";

/** Platform admin queries and platform settings (plan 19). Guarded by requirePlatformAdmin in every caller. */

export type StudioState = "trial" | "active" | "past_due" | "comped" | "suspended" | "read_only" | "deleted";

type StateFields = {
  deleted_at: string | null; suspended_at?: string | null; plan_override?: string | null; read_only_since?: string | null;
  subscription_status: string | null; trial_ends_at: string | null; current_period_end?: string | null; cancel_at_period_end?: boolean | null; grace_ends_at?: string | null;
};

/** A single label for a studio's state, in priority order. */
export function studioState(s: StateFields): StudioState {
  if (s.deleted_at) return "deleted";
  if (s.suspended_at) return "suspended";
  if (s.plan_override === "comped") return "comped";
  const bs = billingState({
    plan: "studio", trial_ends_at: s.trial_ends_at, subscription_status: s.subscription_status,
    current_period_end: s.current_period_end ?? null, cancel_at_period_end: s.cancel_at_period_end ?? null,
    suspended_at: s.suspended_at ?? null, read_only_since: s.read_only_since ?? null, grace_ends_at: s.grace_ends_at ?? null, plan_override: s.plan_override ?? null,
  });
  if (s.read_only_since && !bs.canWrite) return "read_only";
  if (bs.status === "past_due") return "past_due";
  if (bs.trialing) return "trial";
  return "active";
}

export type AdminStudioRow = {
  id: string; name: string; slug: string; owner_email: string | null; created_at: string; updated_at: string;
  storage_bytes: number; members: number; stripe_charges_enabled: boolean; stripe_account_id: string | null;
  sending_domain: string | null; sending_status: string | null;
  deleted_at: string | null; suspended_at: string | null; plan_override: string | null; read_only_since: string | null; subscription_status: string | null; trial_ends_at: string | null; purge_at: string | null;
};

export async function listStudios(opts: { q?: string; state?: string; limit?: number } = {}) {
  const like = opts.q?.trim() ? `%${opts.q.trim().toLowerCase()}%` : null;
  const list = await rows<AdminStudioRow>(
    await db()`
      select s.id, s.name, s.slug, s.created_at::text, s.updated_at::text, s.storage_bytes,
        s.stripe_charges_enabled, s.stripe_account_id, s.deleted_at::text, s.suspended_at::text,
        s.plan_override, s.read_only_since::text, s.subscription_status, s.trial_ends_at::text, s.purge_at::text,
        (select count(*)::int from memberships m where m.studio_id = s.id) as members,
        (select u.email from memberships m join users u on u.id = m.user_id where m.studio_id = s.id and m.role = 'owner' limit 1) as owner_email,
        sd.domain as sending_domain, sd.status as sending_status
      from studios s
      left join sending_domains sd on sd.studio_id = s.id
      where (${like}::text is null or lower(s.name) like ${like} or lower(s.slug) like ${like}
        or exists (select 1 from memberships m join users u on u.id = m.user_id where m.studio_id = s.id and lower(u.email) like ${like}))
      order by s.created_at desc
      limit ${Math.min(opts.limit ?? 200, 500)}`
  );
  const wanted = opts.state && opts.state !== "all" ? opts.state : null;
  return wanted ? list.filter((s) => studioState(s) === wanted) : list;
}

export async function studioForAdmin(id: string) {
  const studio = one<Studio & { owner_email: string | null; owner_name: string | null }>(
    await db()`
      select s.*, u.email as owner_email, u.name as owner_name
      from studios s
      left join memberships m on m.studio_id = s.id and m.role = 'owner'
      left join users u on u.id = m.user_id
      where s.id = ${id}`
  );
  if (!studio) return null;
  const counts = one<{ clients: number; orders: number; galleries: number; photos: number }>(
    await db()`select
      (select count(*)::int from clients where studio_id = ${id}) as clients,
      (select count(*)::int from orders where studio_id = ${id}) as orders,
      (select count(*)::int from galleries where studio_id = ${id} and deleted_at is null) as galleries,
      (select count(*)::int from photos where studio_id = ${id} and deleted_at is null) as photos`
  );
  return { studio, counts: counts ?? { clients: 0, orders: 0, galleries: 0, photos: 0 } };
}

// ---- Lifecycle actions (plan 19.3) -----------------------------------------

export async function suspendStudio(id: string, suspend: boolean) {
  await db()`update studios set suspended_at = ${suspend ? new Date().toISOString() : null} where id = ${id}`;
}

export async function extendTrial(id: string, days: number) {
  const d = Math.max(1, Math.min(365, Math.round(days)));
  await db()`update studios set trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + ${`${d} days`}::interval where id = ${id}`;
}

export async function compStudio(id: string, comp: boolean) {
  await db()`update studios set plan_override = ${comp ? "comped" : null}, read_only_since = case when ${comp} then null else read_only_since end where id = ${id}`;
}

export async function forceReadOnly(id: string, on: boolean) {
  await db()`update studios set read_only_since = ${on ? new Date().toISOString() : null} where id = ${id}`;
}

export async function schedulePurge(id: string, days: number) {
  const d = Math.max(0, Math.min(365, Math.round(days)));
  await db()`update studios set deleted_at = coalesce(deleted_at, now()), purge_at = now() + ${`${d} days`}::interval where id = ${id}`;
}

export async function cancelPurge(id: string) {
  await db()`update studios set purge_at = null, deleted_at = null where id = ${id}`;
}

// ---- Platform settings (plan 19.9) -----------------------------------------

export type PlatformSettings = { signups_open: boolean; maintenance_banner: string; min_plugin_version: string };

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const list = (await db()`select key, value from platform_settings where key in ('signups', 'maintenance_banner', 'plugin')`) as Array<{ key: string; value: Record<string, unknown> }>;
  const map = new Map(list.map((r) => [r.key, r.value]));
  return {
    signups_open: (map.get("signups")?.open ?? true) as boolean,
    maintenance_banner: (map.get("maintenance_banner")?.text as string) ?? "",
    min_plugin_version: (map.get("plugin")?.min_version as string) ?? "1.0.0",
  };
}

export async function setPlatformSetting(key: string, value: Record<string, unknown>) {
  await db()`insert into platform_settings (key, value, updated_at) values (${key}, ${JSON.stringify(value)}::jsonb, now()) on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

// ---- Metrics (plan 19.5) ---------------------------------------------------

const PLAN_PRICE_CENTS = 4000;

export async function platformMetrics() {
  const all = await rows<AdminStudioRow>(await db()`
    select s.id, s.name, s.slug, s.created_at::text, s.updated_at::text, s.storage_bytes, s.stripe_charges_enabled, s.stripe_account_id,
      s.deleted_at::text, s.suspended_at::text, s.plan_override, s.read_only_since::text, s.subscription_status, s.trial_ends_at::text, s.purge_at::text,
      0 as members, null as owner_email, null as sending_domain, null as sending_status
    from studios s`);
  const byState: Record<string, number> = {};
  for (const s of all) byState[studioState(s)] = (byState[studioState(s)] ?? 0) + 1;

  const active = all.filter((s) => s.subscription_status === "active" && !s.deleted_at).length;
  const everSubscribed = all.filter((s) => s.subscription_status).length;
  const nonComped = all.filter((s) => !s.deleted_at && s.plan_override !== "comped").length;
  const conversion = nonComped > 0 ? Math.round((everSubscribed / nonComped) * 100) : 0;

  const signups = (await db()`
    select to_char(date_trunc('week', created_at), 'YYYY-MM-DD') as week, count(*)::int as n
    from studios where created_at >= now() - interval '56 days' group by 1 order by 1`) as Array<{ week: string; n: number }>;

  const storageTotal = all.reduce((sum, s) => sum + Number(s.storage_bytes), 0);
  const topStorage = [...all].sort((a, b) => Number(b.storage_bytes) - Number(a.storage_bytes)).slice(0, 10).map((s) => ({ id: s.id, name: s.name, bytes: Number(s.storage_bytes) }));

  const galleriesLive = one<{ n: number }>(await db()`select count(*)::int as n from galleries where status = 'published' and deleted_at is null`);
  const emails = one<{ sent: number; failed: number }>(await db()`
    select count(*) filter (where status = 'sent')::int as sent, count(*) filter (where status = 'failed')::int as failed
    from email_log where created_at >= now() - interval '30 days'`);
  const rewards = one<{ n: number }>(await db()`select count(*)::int as n from referrals where status = 'rewarded'`);

  return {
    byState,
    mrrCents: active * PLAN_PRICE_CENTS,
    activeSubscriptions: active,
    conversion,
    signups,
    storageTotal,
    topStorage,
    galleriesLive: galleriesLive?.n ?? 0,
    emailsSent: emails?.sent ?? 0,
    emailsFailed: emails?.failed ?? 0,
    rewardsGranted: rewards?.n ?? 0,
  };
}

// ---- Referrals (plan 19.8) -------------------------------------------------

export async function listReferrals(limit = 200) {
  return rows<{ id: string; code: string; status: string; referred_email: string | null; referrer_name: string | null; referred_name: string | null; rewarded_at: string | null; void_reason: string | null; created_at: string }>(
    await db()`
      select r.id, r.code, r.status, r.referred_email, rs.name as referrer_name, ds.name as referred_name, r.rewarded_at::text, r.void_reason, r.created_at::text
      from referrals r
      left join studios rs on rs.id = r.referrer_studio_id
      left join studios ds on ds.id = r.referred_studio_id
      order by r.created_at desc limit ${limit}`
  );
}

export async function voidReferral(id: string, reason: string) {
  await db()`update referrals set status = 'void', void_reason = ${reason || "voided by admin"} where id = ${id}`;
}

export async function reactivateReferral(id: string) {
  await db()`update referrals set status = case when referred_studio_id is not null then 'signed_up' else 'invited' end, void_reason = null where id = ${id} and status = 'void'`;
}

// ---- Leads (plan 19.6) -----------------------------------------------------

export async function listLeads(limit = 200) {
  return rows<{ id: string; email: string; name: string | null; message: string | null; source: string | null; created_at: string; contacted_at: string | null }>(
    await db()`select id, email, name, message, source, created_at::text, contacted_at::text from leads order by created_at desc limit ${limit}`
  );
}

export async function markLeadContacted(id: string, contacted: boolean) {
  await db()`update leads set contacted_at = ${contacted ? new Date().toISOString() : null} where id = ${id}`;
}

// ---- Cross-studio email log (plan 19.7) ------------------------------------

export async function adminEmailStats(days = 30) {
  const totals = one<{ sent: number; failed: number; skipped: number; bounced: number; complained: number }>(await db()`
    select count(*) filter (where status = 'sent')::int as sent,
      count(*) filter (where status = 'failed')::int as failed,
      count(*) filter (where status = 'skipped')::int as skipped,
      count(*) filter (where bounced_at is not null)::int as bounced,
      count(*) filter (where complained_at is not null)::int as complained
    from email_log where created_at >= now() - ${`${days} days`}::interval`);
  const recent = rows<{ id: string; to_address: string; subject: string; status: string; template_key: string | null; created_at: string; studio_name: string | null }>(
    await db()`select e.id, e.to_address, e.subject, e.status, e.template_key, e.created_at::text, s.name as studio_name
      from email_log e left join studios s on s.id = e.studio_id order by e.created_at desc limit 100`
  );
  return { totals: totals ?? { sent: 0, failed: 0, skipped: 0, bounced: 0, complained: 0 }, recent: await recent };
}
