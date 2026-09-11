import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudioPage } from "@/lib/auth";
import { db, one, rows } from "@/lib/db";
import { listOrders } from "@/lib/orders";
import { formatDate, formatMoney, orderStatusLabels, type Client, type OrderStatus } from "@/lib/types";
import { PageHeader, Card, Stat, ButtonLink, Badge } from "@/components/ui";
import { Tabs } from "@/components/ui/tabs";
import { EditClientButton, StageSelect, TimelineComposer } from "./client-forms";
import { archiveClientAction } from "../actions";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand" | "gold";
const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  draft: "neutral",
  pending_payment: "danger",
  paid: "success",
  scheduled: "info",
  editing: "warning",
  proofing: "warning",
  final_delivered: "success",
  completed: "success",
  cancelled: "neutral",
};

export async function generateMetadata({ params }: PageProps<"/studio/clients/[id]">) {
  const { id } = await params;
  const ctx = await requireStudioPage();
  const c = one<{ name: string }>(await db()`select name from clients where id = ${id} and studio_id = ${ctx.studio.id}`);
  return { title: c?.name ?? "Client" };
}

type TimelineItem = { kind: string; body: string; at: string; source: "note" | "event"; author: string | null };

export default async function ClientDetailPage({ params, searchParams }: PageProps<"/studio/clients/[id]">) {
  const ctx = await requireStudioPage();
  const { id } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "timeline";

  const client = one<Client>(await db()`select * from clients where id = ${id} and studio_id = ${ctx.studio.id}`);
  if (!client) notFound();

  const [money, orders, galleries] = await Promise.all([
    one<{ total: number; paid: number; sessions: number }>(
      await db()`
        select
          coalesce(sum(o.amount_cents - o.discount_cents), 0)::int as total,
          coalesce(sum((select coalesce(sum(p.amount_cents - p.refunded_cents),0) from payments p where p.order_id = o.id and p.status in ('paid','partially_refunded'))), 0)::int as paid,
          count(*)::int as sessions
        from orders o where o.client_id = ${id} and o.studio_id = ${ctx.studio.id} and o.status not in ('cancelled','draft')`
    ),
    tab === "sessions" || tab === "timeline" ? listOrders(ctx.studio.id, { clientId: id }) : Promise.resolve([]),
    tab === "galleries"
      ? rows<{ id: string; title: string; status: string; kind: string; created_at: string; photos: number; favorites: number }>(
          await db()`
            select g.id, g.title, g.status, g.kind, g.created_at,
              (select count(*)::int from photos ph where ph.gallery_id = g.id) as photos,
              (select count(*)::int from photo_selections s join photos ph on ph.id = s.photo_id where ph.gallery_id = g.id) as favorites
            from galleries g where g.client_id = ${id} and g.studio_id = ${ctx.studio.id} and g.parent_id is null order by g.created_at desc`
        )
      : Promise.resolve([]),
  ]);

  const timeline: TimelineItem[] =
    tab === "timeline"
      ? [
          ...rows<{ kind: string; body: string; created_at: string; author: string | null }>(
            await db()`select cn.kind, cn.body, cn.created_at, u.name as author from client_notes cn left join users u on u.id = cn.created_by where cn.client_id = ${id} and cn.studio_id = ${ctx.studio.id} order by cn.created_at desc limit 100`
          ).map((n) => ({ kind: n.kind, body: n.body, at: n.created_at, source: "note" as const, author: n.author })),
          ...rows<{ kind: string; summary: string; created_at: string }>(
            await db()`select kind, summary, created_at from client_events where client_id = ${id} and studio_id = ${ctx.studio.id} order by created_at desc limit 100`
          ).map((e) => ({ kind: e.kind, body: e.summary, at: e.created_at, source: "event" as const, author: null })),
        ].sort((a, b) => (a.at < b.at ? 1 : -1))
      : [];

  const balance = Math.max(0, (money?.total ?? 0) - (money?.paid ?? 0));

  return (
    <>
      <PageHeader
        eyebrow="Client"
        title={client.name}
        description={[client.email, client.phone, client.company].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StageSelect client={client} />
            <EditClientButton client={client} />
            <ButtonLink href={`/studio/sessions?client=${client.id}&new=1`}>New session</ButtonLink>
          </div>
        }
      />

      {client.tags.length ? (
        <div className="mb-4 flex flex-wrap gap-1.5">{client.tags.map((t) => <Link key={t} href={`/studio/clients?tag=${encodeURIComponent(t)}`}><Badge>{t}</Badge></Link>)}</div>
      ) : null}
      {client.unsubscribed_at ? <div className="mb-4"><Badge tone="warning">Unsubscribed from marketing on {formatDate(client.unsubscribed_at)}</Badge></div> : null}
      {client.archived ? (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-line bg-surface-2 px-4 py-2 text-sm">
          <span>This client is archived.</span>
          <form action={archiveClientAction}><input type="hidden" name="id" value={client.id} /><input type="hidden" name="archive" value="false" /><button className="underline">Restore</button></form>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Stat label="Sessions" value={money?.sessions ?? 0} />
        <Stat label="Billed" value={formatMoney(money?.total ?? 0, ctx.studio.currency)} />
        <Stat label="Balance due" value={balance > 0 ? formatMoney(balance, ctx.studio.currency) : "Paid up"} />
      </div>

      <Tabs
        items={[
          { value: "timeline", label: "Timeline" },
          { value: "sessions", label: "Sessions", count: money?.sessions ?? 0 },
          { value: "galleries", label: "Galleries" },
        ]}
        defaultValue="timeline"
      />

      <div className="mt-4">
        {tab === "timeline" ? (
          <div className="space-y-4">
            <TimelineComposer clientId={client.id} />
            <ol className="space-y-2">
              {timeline.length === 0 ? <li className="text-sm text-muted px-1">Nothing yet. Notes and activity appear here.</li> : null}
              {timeline.map((t, i) => (
                <li key={i} className="flex gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-line-2" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words">{t.body}</p>
                    <p className="mt-1 text-xs text-muted">
                      {t.source === "note" && t.kind !== "note" ? `${t.kind} · ` : ""}
                      {formatDate(t.at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      {t.author ? ` · ${t.author}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {tab === "sessions" ? (
          orders.length === 0 ? (
            <Card><p className="text-sm text-muted">No sessions yet. <Link href={`/studio/sessions?client=${client.id}&new=1`} className="underline">Book one</Link>.</p></Card>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 border-b border-line font-medium">Session</th><th className="px-4 py-3 border-b border-line font-medium">Date</th><th className="px-4 py-3 border-b border-line font-medium">Status</th><th className="px-4 py-3 border-b border-line font-medium text-right">Total</th><th className="px-4 py-3 border-b border-line font-medium text-right">Balance</th>
                </tr></thead>
                <tbody>
                  {orders.map((o) => {
                    const bal = Math.max(0, o.amount_cents - o.discount_cents - o.paid_cents);
                    return (
                      <tr key={o.id} className="hover:bg-surface-2/60">
                        <td className="px-4 py-3 border-b border-line"><Link href={`/studio/sessions/${o.id}`} className="font-medium hover:underline">#{o.order_number} {o.title}</Link></td>
                        <td className="px-4 py-3 border-b border-line text-ink-2">{o.scheduled_at ? formatDate(o.scheduled_at) : "—"}</td>
                        <td className="px-4 py-3 border-b border-line"><Badge tone={ORDER_STATUS_TONE[o.status as OrderStatus] ?? "neutral"}>{orderStatusLabels[o.status as OrderStatus] ?? o.status}</Badge></td>
                        <td className="px-4 py-3 border-b border-line text-right">{formatMoney(o.amount_cents - o.discount_cents, o.currency)}</td>
                        <td className="px-4 py-3 border-b border-line text-right">{bal > 0 ? <span className="text-danger font-medium">{formatMoney(bal, o.currency)}</span> : <span className="text-muted">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {tab === "galleries" ? (
          galleries.length === 0 ? (
            <Card><p className="text-sm text-muted">No galleries yet.</p></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {galleries.map((g) => (
                <Link key={g.id} href={`/studio/galleries/${g.id}`} className="card card-pad hover:border-line-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{g.title}</span>
                    <Badge tone={g.status === "published" ? "success" : "neutral"}>{g.status === "published" ? "Live" : "Draft"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">{g.photos} photos · {g.favorites} favorited · {formatDate(g.created_at)}</p>
                </Link>
              ))}
            </div>
          )
        ) : null}
      </div>
    </>
  );
}
