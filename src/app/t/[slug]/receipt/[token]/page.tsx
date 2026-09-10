import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { verifyLink } from "@/lib/tenant-tokens";
import { db, one } from "@/lib/db";
import { formatMoney, formatDate } from "@/lib/types";

export const metadata = { robots: { index: false, follow: false } };

export default async function ReceiptPage({ params }: PageProps<"/t/[slug]/receipt/[token]">) {
  const { slug, token } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const paymentId = verifyLink("receipt", token);
  if (!paymentId) return <div className="mx-auto w-full max-w-md px-5 py-24 text-center"><h1 className="text-2xl font-semibold">This link has expired</h1></div>;
  const payment = one<{ id: string; amount_cents: number; refunded_cents: number; currency: string; method: string; status: string; paid_at: string | null; created_at: string; order_id: string }>(
    await db()`select id, amount_cents, refunded_cents, currency, method, status, paid_at, created_at, order_id from payments where id = ${paymentId} and studio_id = ${studio.id}`
  );
  if (!payment) notFound();
  const order = one<{ order_number: number; title: string; client_id: string }>(await db()`select order_number, title, client_id from orders where id = ${payment.order_id}`);
  const client = order ? one<{ name: string; email: string }>(await db()`select name, email from clients where id = ${order.client_id}`) : null;

  return (
    <div className="mx-auto w-full max-w-lg px-5 sm:px-8 py-12 print:py-0">
      <div className="flex items-start justify-between">
        <div><p className="text-lg font-semibold">{studio.name}</p><p className="text-sm text-[var(--site-ink-2)]">{studio.email}</p></div>
        <div className="text-right"><p className="text-xl font-semibold">Receipt</p><p className="text-xs text-[var(--site-ink-2)]">{formatDate(payment.paid_at ?? payment.created_at)}</p></div>
      </div>
      {client ? <p className="mt-6 text-sm">Paid by <span className="font-medium">{client.name}</span></p> : null}
      <div className="mt-6 rounded-xl border border-[var(--site-line)] p-4 text-sm">
        {order ? <p className="text-[var(--site-ink-2)]">For #{order.order_number} {order.title}</p> : null}
        <div className="mt-3 flex items-center justify-between"><span>Amount paid</span><span className="text-xl font-semibold">{formatMoney(payment.amount_cents - payment.refunded_cents, payment.currency)}</span></div>
        <p className="mt-1 text-[var(--site-ink-2)] text-xs">Method: {payment.method}{payment.status === "refunded" ? " · refunded" : payment.status === "partially_refunded" ? ` · ${formatMoney(payment.refunded_cents, payment.currency)} refunded` : ""}</p>
      </div>
    </div>
  );
}
