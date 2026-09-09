import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { db, one, rows } from "@/lib/db";
import { formatBytes } from "@/lib/plans";
import { getUsage } from "@/lib/usage";
import { formatDate, formatMoney } from "@/lib/types";
import { Card, PageHeader, Stat, ButtonLink } from "@/components/ui";
import { OnboardingChecklist } from "@/components/studio/onboarding";

export default async function DashboardPage({ searchParams }: PageProps<"/studio">) {
  const ctx = await requireStudioPage();
  const sp = await searchParams;
  const s = ctx.studio;
  const [usage, counts, todos, upcoming, activity] = await Promise.all([
    getUsage(s.id),
    one<{ clients: number; live: number; notes: number; unpaid: number; unpaid_cents: number; inbox: number; packages: number; pages: number; tokens: number; assets: number }>(
      await db()`
        select
          (select count(*)::int from clients where studio_id = ${s.id} and not archived) as clients,
          (select count(*)::int from galleries where studio_id = ${s.id} and status = 'published') as live,
          (select count(*)::int from photo_comments where studio_id = ${s.id} and author_role = 'client' and not resolved) as notes,
          (select count(*)::int from orders where studio_id = ${s.id} and status not in ('cancelled','draft') and paid_at is null) as unpaid,
          (select count(*)::int from inquiries where studio_id = ${s.id} and status = 'new') as inbox,
          (select count(*)::int from packages where studio_id = ${s.id} and is_active) as packages,
          (select count(*)::int from site_pages where studio_id = ${s.id} and is_published) as pages,
          (select count(*)::int from api_tokens where studio_id = ${s.id} and revoked_at is null) as tokens,
          (select count(*)::int from assets where studio_id = ${s.id}) as assets,
          0 as unpaid_cents`
    ),
    rows<{ id: string; title: string; due_on: string | null; client_name: string | null; client_id: string | null }>(
      await db()`
        select t.id, t.title, t.due_on::text, c.name as client_name, t.client_id
        from tasks t left join clients c on c.id = t.client_id
        where t.studio_id = ${s.id} and t.done_at is null
        order by t.due_on nulls last, t.created_at limit 8`
    ),
    rows<{ id: string; title: string; shoot_date: string; client_name: string; client_id: string; amount_cents: number; currency: string }>(
      await db()`
        select o.id, o.title, o.shoot_date::text, c.name as client_name, c.id as client_id, o.amount_cents, o.currency
        from orders o join clients c on c.id = o.client_id
        where o.studio_id = ${s.id} and o.shoot_date >= current_date and o.status <> 'cancelled'
        order by o.shoot_date asc limit 6`
    ),
    rows<{ action: string; actor_label: string | null; created_at: string; target_type: string | null }>(
      await db()`select action, actor_label, created_at, target_type from audit_log where studio_id = ${s.id} order by created_at desc limit 10`
    ),
  ]);

  const onboarding = {
    verified: Boolean(ctx.user.email_verified_at),
    branded: Boolean(s.logo_url) || s.brand_color !== "#111111",
    website: (counts?.pages ?? 0) > 0,
    payments: s.stripe_account_status === "enabled",
    packages: (counts?.packages ?? 0) > 0,
    client: (counts?.clients ?? 0) > 0,
    gallery: (counts?.live ?? 0) > 0 || (await db()`select 1 from galleries where studio_id = ${s.id} limit 1`).length > 0,
    lightroom: (counts?.tokens ?? 0) > 0,
  };
  const allDone = Object.values(onboarding).every(Boolean);

  return (
    <>
      <PageHeader
        title={sp.welcome === "1" ? `Welcome, ${ctx.user.name.split(" ")[0] || "there"}` : "Dashboard"}
        description={sp.welcome === "1" ? "Your studio is ready. Work through the checklist below and you can send your first gallery today." : undefined}
        actions={
          <>
            <ButtonLink href="/studio/clients?new=1" variant="secondary">Add client</ButtonLink>
            <ButtonLink href="/studio/galleries?new=1">New gallery</ButtonLink>
          </>
        }
      />
      {!allDone && !s.onboarding?.dismissed ? <OnboardingChecklist state={onboarding} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">
        <Stat label="Live galleries" value={counts?.live ?? 0} />
        <Stat label="Notes to answer" value={counts?.notes ?? 0} hint={(counts?.notes ?? 0) > 0 ? "Clients are waiting on a reply" : undefined} />
        <Stat label="Unpaid sessions" value={counts?.unpaid ?? 0} />
        <Stat label="Storage" value={formatBytes(usage.storageBytes)} hint={`of ${formatBytes(ctx.entitlements.limits.storageBytes)} on ${ctx.entitlements.effectivePlan}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3 mt-6">
        <Card>
          <h2 className="font-medium">To do</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(counts?.inbox ?? 0) > 0 ? <li><Link href="/studio/inbox" className="underline">{counts!.inbox} new message{counts!.inbox === 1 ? "" : "s"}</Link> in the inbox</li> : null}
            {(counts?.notes ?? 0) > 0 ? <li><Link href="/studio/galleries?notes=open" className="underline">{counts!.notes} client note{counts!.notes === 1 ? "" : "s"}</Link> to answer</li> : null}
            {todos.map((t) => (
              <li key={t.id} className="flex justify-between gap-3">
                <span>{t.title}{t.client_name ? <> · <Link href={`/studio/clients/${t.client_id}`} className="underline">{t.client_name}</Link></> : null}</span>
                {t.due_on ? <span className="text-muted whitespace-nowrap">{formatDate(t.due_on, { month: "short", day: "numeric" })}</span> : null}
              </li>
            ))}
            {todos.length === 0 && !(counts?.inbox || counts?.notes) ? <li className="text-muted">Nothing waiting on you.</li> : null}
          </ul>
        </Card>
        <Card>
          <h2 className="font-medium">Upcoming shoots</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {upcoming.map((o) => (
              <li key={o.id} className="flex justify-between gap-3">
                <span><Link href={`/studio/clients/${o.client_id}`} className="underline">{o.client_name}</Link> · {o.title}</span>
                <span className="text-muted whitespace-nowrap">{formatDate(o.shoot_date, { month: "short", day: "numeric" })} · {formatMoney(o.amount_cents, o.currency)}</span>
              </li>
            ))}
            {upcoming.length === 0 ? <li className="text-muted">No shoots scheduled. Add a shoot date on a session.</li> : null}
          </ul>
        </Card>
        <Card>
          <h2 className="font-medium">Recent activity</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {activity.map((a, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate">{a.action.replace(/[._]/g, " ")}{a.actor_label ? ` · ${a.actor_label}` : ""}</span>
                <span className="text-muted whitespace-nowrap">{formatDate(a.created_at, { month: "short", day: "numeric" })}</span>
              </li>
            ))}
            {activity.length === 0 ? <li className="text-muted">Activity will appear here.</li> : null}
          </ul>
        </Card>
      </div>
    </>
  );
}
