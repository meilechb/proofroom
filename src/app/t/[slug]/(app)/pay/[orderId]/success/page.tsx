import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { getOrder } from "@/lib/orders";
import { listPayments } from "@/lib/payments";
import { db, one } from "@/lib/db";
import { orderMoney } from "@/lib/types";

export const metadata = { robots: { index: false, follow: false } };

export default async function PaySuccessPage({ params }: PageProps<"/t/[slug]/pay/[orderId]/success">) {
  const { slug, orderId } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const order = await getOrder(studio.id, orderId);
  if (!order) notFound();
  const payments = await listPayments(order.id);
  const picks = one<{ n: number }>(await db()`select count(*)::int as n from photo_selections ps join galleries g on g.id = ps.gallery_id where g.order_id = ${order.id} and ps.selected`);
  const money = orderMoney(order, payments, picks?.n ?? 0);

  return (
    <div className="mx-auto w-full max-w-lg px-5 py-24 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-[var(--site-primary)] text-[var(--site-primary-ink)] flex items-center justify-center text-2xl" aria-hidden>✓</div>
      <h1 className="mt-4 text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>Payment received</h1>
      <p className="mt-3 text-[var(--site-ink-2)]">
        Thank you. {money.fully_paid ? `${studio.name} will be in touch.` : "Your remaining balance can be paid any time."}
      </p>
      {!money.fully_paid ? <a href={`/pay/${order.id}`} className="mt-6 inline-block underline">Back to the session</a> : null}
    </div>
  );
}
