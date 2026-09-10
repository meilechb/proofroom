import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudioPage } from "@/lib/auth";
import { getOrder } from "@/lib/orders";
import { listPayments } from "@/lib/payments";
import { slotForOrder } from "@/lib/booking";
import { getPlan, SHOT_LIST_TEMPLATES } from "@/lib/planning";
import { listAssets, isReady } from "@/lib/assets";
import { db, one, rows } from "@/lib/db";
import { payUrl } from "@/lib/tenant";
import { orderMoney, formatMoney, formatDate, orderStatusLabels, type Client, type OrderStatus } from "@/lib/types";
import { PageHeader, Card, Badge, ButtonLink, cx } from "@/components/ui";
import type { PickerAsset } from "@/app/(studio)/studio/website/image-picker";
import { CancelSessionButton, EditSessionButton, ManualPaymentButton, NoShowButton, PayLink } from "./session-forms";
import { PlanCard } from "./plan-card";
import { undoManualPaymentAction } from "./session-actions";

export async function generateMetadata({ params }: PageProps<"/studio/sessions/[id]">) {
  const { id } = await params;
  const ctx = await requireStudioPage();
  const o = await getOrder(ctx.studio.id, id);
  return { title: o ? `#${o.order_number} ${o.title}` : "Session" };
}

export default async function SessionDetailPage({ params }: PageProps<"/studio/sessions/[id]">) {
  const ctx = await requireStudioPage();
  const { id } = await params;
  const order = await getOrder(ctx.studio.id, id);
  if (!order) notFound();

  const [client, payments, picks, galleries, events] = await Promise.all([
    one<Client>(await db()`select * from clients where id = ${order.client_id} and studio_id = ${ctx.studio.id}`),
    listPayments(id),
    one<{ n: number }>(await db()`select count(*)::int as n from photo_selections s join photos ph on ph.id = s.photo_id join galleries g on g.id = ph.gallery_id where g.order_id = ${id}`),
    rows<{ id: string; title: string; status: string; kind: string }>(await db()`select id, title, status, kind from galleries where order_id = ${id} and studio_id = ${ctx.studio.id} and parent_id is null order by created_at desc`),
    rows<{ kind: string; summary: string; created_at: string }>(await db()`select kind, summary, created_at from client_events where ref_type = 'order' and ref_id = ${id} and studio_id = ${ctx.studio.id} order by created_at desc limit 30`),
  ]);
  const money = orderMoney(order, payments, picks?.n ?? 0);
  const cur = order.currency;
  const link = payUrl(ctx.studio, order.id);
  const canPayOnline = ctx.studio.stripe_account_status === "enabled";
  const slot = await slotForOrder(ctx.studio.id, order.id);
  const slotPast = slot ? new Date(slot.starts_at).getTime() < new Date().getTime() : false;
  const [plan, assetRows] = await Promise.all([getPlan(ctx.studio.id, order.id), listAssets(ctx.studio.id)]);
  const pickerAssets: PickerAsset[] = assetRows.filter((a) => a.kind === "image" && isReady(a)).map((a) => ({ id: a.id, thumb: a.thumb_url ?? a.web_url ?? a.url, filename: a.filename, alt: a.alt }));

  return (
    <>
      <PageHeader
        eyebrow={`Session #${order.order_number}`}
        title={order.title}
        description={[client?.name, order.scheduled_at ? formatDate(order.scheduled_at, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not scheduled", order.location].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={order.status === "completed" ? "success" : order.status === "cancelled" ? "neutral" : order.status === "pending_payment" ? "warning" : "brand"}>{orderStatusLabels[order.status as OrderStatus] ?? order.status}</Badge>
            {slot?.status === "no_show" ? <Badge tone="neutral">No-show</Badge> : null}
            {slot && slot.status === "confirmed" && slotPast && order.status !== "cancelled" ? <NoShowButton orderId={order.id} /> : null}
            {order.status !== "cancelled" ? <EditSessionButton order={order} timezone={ctx.studio.timezone} /> : null}
            {client ? <ButtonLink href={`/studio/clients/${client.id}`} variant="ghost">Client</ButtonLink> : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Money */}
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Money</h2>
              <ManualPaymentButton orderId={order.id} currency={cur} />
            </div>
            <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><dt className="text-muted text-xs">Total</dt><dd className="text-lg font-semibold">{formatMoney(money.total_cents, cur)}</dd></div>
              <div><dt className="text-muted text-xs">Deposit</dt><dd className="text-lg font-semibold">{formatMoney(money.deposit_cents, cur)}</dd></div>
              <div><dt className="text-muted text-xs">Paid</dt><dd className="text-lg font-semibold text-success">{formatMoney(money.paid_cents, cur)}</dd></div>
              <div><dt className="text-muted text-xs">Balance</dt><dd className={cx("text-lg font-semibold", money.due_cents > 0 ? "text-danger" : "text-ink")}>{formatMoney(money.due_cents, cur)}</dd></div>
            </dl>
            {money.extras_cents > 0 ? <p className="mt-2 text-xs text-muted">Includes {formatMoney(money.extras_cents, cur)} in extra photo picks.</p> : null}

            {order.status !== "cancelled" && money.due_cents > 0 ? (
              <div className="mt-5 rounded-lg border border-line bg-surface-2/50 p-4">
                <p className="text-sm font-medium">Pay link</p>
                {canPayOnline ? (
                  <p className="mt-0.5 text-xs text-muted mb-2">Send this to the client to pay by card on your Stripe account.</p>
                ) : (
                  <p className="mt-0.5 text-xs text-warning mb-2">Connect Stripe in settings to take card payments online. Until then, record payments by hand.</p>
                )}
                <PayLink url={link} />
              </div>
            ) : null}

            {payments.length ? (
              <div className="mt-5">
                <h3 className="text-xs uppercase tracking-wide text-muted mb-2">Payments</h3>
                <ul className="divide-y divide-line text-sm">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2">
                      <span>
                        {formatMoney(p.amount_cents - p.refunded_cents, p.currency)} <span className="text-muted">· {p.method}{p.kind === "manual" ? "" : ` · ${p.kind}`}</span>
                        {p.status === "refunded" ? <Badge tone="neutral" className="ml-2">Refunded</Badge> : p.status === "pending" ? <Badge tone="warning" className="ml-2">Pending</Badge> : null}
                      </span>
                      <span className="flex items-center gap-3 text-muted text-xs">
                        {p.paid_at ? formatDate(p.paid_at) : formatDate(p.created_at)}
                        {p.method !== "card" && p.status === "paid" ? (
                          <form action={undoManualPaymentAction}><input type="hidden" name="paymentId" value={p.id} /><input type="hidden" name="orderId" value={order.id} /><button className="hover:text-danger">Undo</button></form>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          {/* Galleries */}
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Galleries</h2>
              <ButtonLink href={`/studio/galleries?new=1&order=${order.id}${client ? `&client=${client.id}` : ""}`} variant="secondary" size="sm">New gallery</ButtonLink>
            </div>
            {galleries.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No galleries yet. Create one here, or publish from Lightroom.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {galleries.map((g) => (
                  <li key={g.id} className="flex items-center justify-between text-sm">
                    <Link href={`/studio/galleries/${g.id}`} className="font-medium hover:underline">{g.title}</Link>
                    <Badge tone={g.status === "published" ? "success" : "neutral"}>{g.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Session plan */}
          <PlanCard
            orderId={order.id}
            initial={{ notes_md: plan?.notes_md ?? "", shot_list: plan?.shot_list ?? [], mood_asset_ids: plan?.mood_asset_ids ?? [], client_visible: plan?.client_visible ?? false }}
            assets={pickerAssets}
            templates={SHOT_LIST_TEMPLATES}
            printHref={`/plan/${order.id}/print`}
          />
        </div>

        <div className="space-y-6">
          {/* Agreement */}
          <Card>
            <h2 className="font-medium">Agreement</h2>
            {order.contract_signed_at ? (
              <div className="mt-2 text-sm">
                <Badge tone="success">Signed</Badge>
                <p className="mt-2 text-ink-2">Signed by {order.contract_signed_name} on {formatDate(order.contract_signed_at, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}.</p>
                {order.contract_version ? <p className="text-xs text-muted mt-1">Version {order.contract_version}</p> : null}
              </div>
            ) : (
              <div className="mt-2 text-sm">
                <Badge>Not signed</Badge>
                <p className="mt-2 text-ink-2">The client signs on the pay page before paying. <Link href="/studio/settings/agreement" className="underline">Edit the template</Link>.</p>
              </div>
            )}
          </Card>

          {order.notes ? (
            <Card>
              <h2 className="font-medium">Notes</h2>
              <p className="mt-2 text-sm text-ink-2 whitespace-pre-wrap">{order.notes}</p>
            </Card>
          ) : null}

          {/* Timeline */}
          <Card>
            <h2 className="font-medium">Activity</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {events.length === 0 ? <li className="text-muted">Nothing yet.</li> : null}
              {events.map((e, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-ink-2">{e.summary}</span>
                  <span className="text-muted whitespace-nowrap text-xs">{formatDate(e.created_at, { month: "short", day: "numeric" })}</span>
                </li>
              ))}
            </ol>
          </Card>

          {order.status !== "cancelled" ? <div className="flex justify-end"><CancelSessionButton orderId={order.id} /></div> : null}
        </div>
      </div>
    </>
  );
}
