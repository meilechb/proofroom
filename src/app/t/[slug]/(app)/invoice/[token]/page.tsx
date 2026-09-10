import Link from "next/link";
import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { verifyLink } from "@/lib/tenant-tokens";
import { getOrder } from "@/lib/orders";
import { listPayments } from "@/lib/payments";
import { db, one } from "@/lib/db";
import { orderMoney, formatMoney, formatDate } from "@/lib/types";

export const metadata = { robots: { index: false, follow: false } };

export default async function InvoicePage({ params }: PageProps<"/t/[slug]/invoice/[token]">) {
  const { slug, token } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const orderId = verifyLink("invoice", token);
  if (!orderId) return <Expired />;
  const order = await getOrder(studio.id, orderId);
  if (!order) notFound();
  const client = one<{ name: string; email: string }>(await db()`select name, email from clients where id = ${order.client_id}`);
  const payments = await listPayments(order.id);
  const picks = one<{ n: number }>(await db()`select count(*)::int as n from photo_selections ps join galleries g on g.id = ps.gallery_id where g.order_id = ${order.id} and ps.selected`);
  const money = orderMoney(order, payments, picks?.n ?? 0);
  const cur = order.currency;

  return (
    <Doc studioName={studio.name} studioEmail={studio.email} title="Invoice" number={`#${order.order_number}`} to={client}>
      <table className="w-full text-sm mt-6">
        <thead><tr className="text-left text-[var(--site-ink-2)] border-b border-[var(--site-line)]"><th className="py-2">Description</th><th className="py-2 text-right">Amount</th></tr></thead>
        <tbody>
          <tr className="border-b border-[var(--site-line)]"><td className="py-2">{order.title}</td><td className="py-2 text-right">{formatMoney(order.amount_cents, cur)}</td></tr>
          {money.extras_cents > 0 ? <tr className="border-b border-[var(--site-line)]"><td className="py-2">Extra photos ({money.extra_picks})</td><td className="py-2 text-right">{formatMoney(money.extras_cents, cur)}</td></tr> : null}
          {order.discount_cents > 0 ? <tr className="border-b border-[var(--site-line)]"><td className="py-2">Discount</td><td className="py-2 text-right">- {formatMoney(order.discount_cents, cur)}</td></tr> : null}
        </tbody>
        <tfoot>
          <tr><td className="py-2 font-semibold">Total</td><td className="py-2 text-right font-semibold">{formatMoney(money.total_cents, cur)}</td></tr>
          <tr><td className="py-1 text-[var(--site-ink-2)]">Paid</td><td className="py-1 text-right text-[var(--site-ink-2)]">- {formatMoney(money.paid_cents, cur)}</td></tr>
          <tr><td className="py-2 font-semibold border-t border-[var(--site-line)]">Balance due</td><td className="py-2 text-right font-semibold border-t border-[var(--site-line)]">{formatMoney(money.due_cents, cur)}</td></tr>
        </tfoot>
      </table>
      {money.due_cents > 0 ? <Link href={`/pay/${order.id}`} className="no-print mt-6 inline-flex items-center justify-center rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] px-4 h-10 text-sm font-medium">Pay balance</Link> : <p className="mt-6 text-[var(--site-ink-2)] text-sm">Paid in full. Thank you.</p>}
    </Doc>
  );
}

function Doc({ studioName, studioEmail, title, number, to, children }: { studioName: string; studioEmail: string; title: string; number: string; to: { name: string; email: string } | null; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 sm:px-8 py-10 print:py-0">
      <div className="flex items-start justify-between">
        <div><p className="text-lg font-semibold">{studioName}</p><p className="text-sm text-[var(--site-ink-2)]">{studioEmail}</p></div>
        <div className="text-right"><p className="text-xl font-semibold">{title}</p><p className="text-sm text-[var(--site-ink-2)]">{number}</p><p className="text-xs text-[var(--site-ink-2)]">{formatDate(new Date().toISOString())}</p></div>
      </div>
      {to ? <p className="mt-6 text-sm">Billed to <span className="font-medium">{to.name}</span> · {to.email}</p> : null}
      {children}
    </div>
  );
}

function Expired() {
  return <div className="mx-auto w-full max-w-md px-5 py-24 text-center"><h1 className="text-2xl font-semibold">This link has expired</h1><p className="mt-3 text-[var(--site-ink-2)]">Ask your photographer for a new one.</p></div>;
}
