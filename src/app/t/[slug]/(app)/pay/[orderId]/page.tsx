import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { agreementForOrder, getOrder } from "@/lib/orders";
import { listPayments } from "@/lib/payments";
import { canTakeCardPayments } from "@/lib/connect";
import { billingState } from "@/lib/plans";
import { db, one } from "@/lib/db";
import { orderMoney, formatMoney, formatDate } from "@/lib/types";
import { SignForm } from "./sign-form";

export const metadata = { robots: { index: false, follow: false } };

export default async function PayPage({ params, searchParams }: PageProps<"/t/[slug]/pay/[orderId]">) {
  const { slug, orderId } = await params;
  const sp = await searchParams;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const order = await getOrder(studio.id, orderId);
  if (!order) notFound();
  const client = one<{ name: string; email: string }>(await db()`select name, email from clients where id = ${order.client_id}`);

  if (order.status === "cancelled") return <Centered title="This session was cancelled" body={`Contact ${studio.name} at ${studio.email} with any questions.`} />;

  const payments = await listPayments(order.id);
  const picks = one<{ n: number }>(await db()`select count(*)::int as n from photo_selections ps join galleries g on g.id = ps.gallery_id where g.order_id = ${order.id} and ps.selected`);
  const money = orderMoney(order, payments, picks?.n ?? 0);
  const cur = order.currency;

  if (money.fully_paid) return <Centered title="You're all paid" body={`Thank you. ${studio.name} will be in touch.`} />;
  if (sp.paid === "1") return <Centered title="Thank you" body="Your payment is being confirmed. This page will update shortly." />;

  const cardsOn = canTakeCardPayments(studio) && billingState(studio).publicLive;
  const agreement = await agreementForOrder(studio.id, order, { studioName: studio.name, studioEmail: studio.email, clientName: client?.name ?? "Client" }).catch(() => null);
  const signed = Boolean(order.contract_signed_at);

  return (
    <div className="mx-auto w-full max-w-lg px-5 py-12">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>{order.title}</h1>
      <p className="mt-1 text-[var(--site-ink-2)]">{studio.name}{order.scheduled_at ? ` · ${formatDate(order.scheduled_at)}` : ""}</p>

      <div className="mt-6 rounded-xl border border-[var(--site-line)] p-4 text-sm">
        <Row label="Session" value={formatMoney(order.amount_cents, cur)} />
        {money.extras_cents > 0 ? <Row label={`Extra photos (${money.extra_picks})`} value={formatMoney(money.extras_cents, cur)} /> : null}
        {order.discount_cents > 0 ? <Row label="Discount" value={`- ${formatMoney(order.discount_cents, cur)}`} /> : null}
        <Row label="Total" value={formatMoney(money.total_cents, cur)} bold />
        {money.paid_cents > 0 ? <Row label="Paid" value={`- ${formatMoney(money.paid_cents, cur)}`} /> : null}
        <div className="mt-2 border-t border-[var(--site-line)] pt-2"><Row label="Due now" value={formatMoney(money.due_cents, cur)} bold /></div>
      </div>

      {sp.cancelled === "1" ? <p className="mt-4 text-sm text-[var(--site-ink-2)]">Payment cancelled. You can try again below.</p> : null}

      {!signed && agreement ? (
        <div className="mt-8">
          <h2 className="font-medium mb-3">Agreement</h2>
          <SignForm slug={slug} orderId={order.id} agreementText={agreement.text} />
        </div>
      ) : (
        <div className="mt-8">
          {signed ? <p className="text-sm text-[var(--site-ink-2)] mb-4">Agreement signed by {order.contract_signed_name}. Thank you.</p> : null}
          {cardsOn ? (
            <div className="space-y-2">
              {money.deposit_due_cents > 0 && money.deposit_due_cents < money.due_cents ? (
                <PayButton orderId={order.id} kind="deposit" label={`Pay the deposit · ${formatMoney(money.deposit_due_cents, cur)}`} primary />
              ) : null}
              <PayButton orderId={order.id} kind="full" label={`Pay ${money.paid_cents > 0 ? "the balance" : "in full"} · ${formatMoney(money.due_cents, cur)}`} primary={money.deposit_due_cents === 0 || money.deposit_due_cents >= money.due_cents} />
              <p className="text-center text-xs text-[var(--site-ink-2)] mt-2">Paid securely to {studio.name} through Stripe.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--site-line)] bg-[var(--site-bg-2)] p-4 text-sm">
              <p className="font-medium">How to pay</p>
              {studio.manual_payment_instructions ? <p className="mt-1 whitespace-pre-wrap text-[var(--site-ink-2)]">{studio.manual_payment_instructions}</p> : <p className="mt-1 text-[var(--site-ink-2)]">Contact {studio.name} at {studio.email} to arrange payment.</p>}
              {studio.manual_payment_link ? <a href={studio.manual_payment_link} className="mt-3 inline-block underline" target="_blank" rel="noopener">Payment link</a> : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PayButton({ orderId, kind, label, primary }: { orderId: string; kind: "deposit" | "full"; label: string; primary?: boolean }) {
  return (
    <form action="/api/pay/checkout" method="post">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="kind" value={kind} />
      <button type="submit" className={primary ? "w-full h-11 rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] font-medium" : "w-full h-11 rounded-lg border border-[var(--site-line)] font-medium"}>{label}</button>
    </form>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className="flex justify-between py-1"><span className={bold ? "font-medium" : "text-[var(--site-ink-2)]"}>{label}</span><span className={bold ? "font-semibold" : ""}>{value}</span></div>;
}

function Centered({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto w-full max-w-lg px-5 py-24 text-center">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>{title}</h1>
      <p className="mt-3 text-[var(--site-ink-2)]">{body}</p>
    </div>
  );
}
