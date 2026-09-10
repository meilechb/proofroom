import Link from "next/link";
import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { verifyLink, signLink } from "@/lib/tenant-tokens";
import { db, one, rows } from "@/lib/db";
import { formatDate, formatMoney, orderStatusLabels, type OrderStatus } from "@/lib/types";
import { bookingSettings, withinChangeWindow } from "@/lib/booking-shared";
import { RequestHubLink } from "./request-form";
import { BookingManage } from "./booking-manage";

export const metadata = { robots: { index: false, follow: false } };

export default async function ClientHubPage({ params }: PageProps<"/t/[slug]/my/[token]">) {
  const { slug, token } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const clientId = verifyLink("hub", token);
  if (!clientId) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-24 text-center">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>This link has expired</h1>
        <p className="mt-3 text-[var(--site-ink-2)]">Enter your email and we will send a fresh one.</p>
        <div className="mt-6"><RequestHubLink slug={slug} /></div>
      </div>
    );
  }

  const client = one<{ id: string; name: string; email: string }>(await db()`select id, name, email from clients where id = ${clientId} and studio_id = ${studio.id}`);
  if (!client) notFound();

  const [galleries, orders, payments, documents, bookings] = await Promise.all([
    rows<{ id: string; slug: string; title: string; kind: string; status: string; created_at: string }>(await db()`select id, slug, title, kind, status, created_at from galleries where client_id = ${client.id} and studio_id = ${studio.id} and status = 'published' and parent_id is null order by created_at desc`),
    rows<{ id: string; order_number: number; title: string; status: string; amount_cents: number; discount_cents: number; scheduled_at: string | null; currency: string; paid: number }>(await db()`select o.id, o.order_number, o.title, o.status, o.amount_cents, o.discount_cents, o.scheduled_at, o.currency, coalesce((select sum(p.amount_cents - p.refunded_cents) from payments p where p.order_id = o.id and p.status in ('paid','partially_refunded')),0)::int as paid from orders o where o.client_id = ${client.id} and o.studio_id = ${studio.id} and o.status <> 'draft' order by o.created_at desc`),
    rows<{ id: string; amount_cents: number; currency: string; method: string; status: string; paid_at: string | null; created_at: string }>(await db()`select id, amount_cents, currency, method, status, paid_at, created_at from payments where studio_id = ${studio.id} and order_id in (select id from orders where client_id = ${client.id}) and status in ('paid','partially_refunded','refunded') order by coalesce(paid_at, created_at) desc`),
    rows<{ id: string; title: string; kind: string; url: string; created_at: string }>(await db()`select id, title, kind, url, created_at from documents where client_id = ${client.id} and studio_id = ${studio.id} order by created_at desc`),
    rows<{ id: string; starts_at: string; ends_at: string; status: string; order_id: string | null }>(await db()`select id, starts_at, ends_at, status, order_id from booking_slots where client_id = ${client.id} and studio_id = ${studio.id} and status = 'confirmed' and starts_at >= now() order by starts_at`),
  ]);
  const cur = studio.currency;
  const booking = bookingSettings((studio.settings ?? {}) as Record<string, unknown>);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 sm:px-8 py-10">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>Hi {client.name.split(" ")[0] || client.name}</h1>
      <p className="mt-1 text-[var(--site-ink-2)]">Everything from {studio.name} in one place.</p>

      <Section title="Galleries">
        {galleries.length === 0 ? <Empty>No galleries yet.</Empty> : galleries.map((g) => (
          <Row key={g.id} href={`/g/${g.slug}`}>
            <span>{g.title}</span>
            <span className="text-[var(--site-ink-2)] text-sm">{g.kind === "final" ? "Finals" : "Proofs"} · {formatDate(g.created_at)}</span>
          </Row>
        ))}
      </Section>

      <Section title="Sessions">
        {orders.length === 0 ? <Empty>No sessions yet.</Empty> : orders.map((o) => {
          const balance = Math.max(0, o.amount_cents - o.discount_cents - o.paid);
          return (
            <div key={o.id} className="flex items-center justify-between border-b border-[var(--site-line)] py-3 text-sm last:border-0">
              <div>
                <p className="font-medium">#{o.order_number} {o.title}</p>
                <p className="text-[var(--site-ink-2)]">{o.scheduled_at ? formatDate(o.scheduled_at) : "Not scheduled"} · {orderStatusLabels[o.status as OrderStatus] ?? o.status}</p>
              </div>
              <div className="text-right">
                <p>{formatMoney(o.amount_cents - o.discount_cents, cur)}</p>
                {balance > 0 ? <Link href={`/pay/${o.id}`} className="text-[var(--site-accent)] underline">Pay {formatMoney(balance, cur)}</Link> : <Link href={`/invoice/${signLink("invoice", o.id)}`} className="text-[var(--site-ink-2)] underline">Invoice</Link>}
              </div>
            </div>
          );
        })}
      </Section>

      <Section title="Payments">
        {payments.length === 0 ? <Empty>No payments yet.</Empty> : payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between border-b border-[var(--site-line)] py-3 text-sm last:border-0">
            <span>{formatDate(p.paid_at ?? p.created_at)} · {p.method}{p.status === "refunded" ? " · refunded" : ""}</span>
            <span className="flex items-center gap-3">{formatMoney(p.amount_cents, p.currency)} <Link href={`/receipt/${signLink("receipt", p.id)}`} className="text-[var(--site-ink-2)] underline">Receipt</Link></span>
          </div>
        ))}
      </Section>

      {documents.length > 0 ? (
        <Section title="Documents">
          {documents.map((d) => <Row key={d.id} href={d.url}><span>{d.title}</span><span className="text-[var(--site-ink-2)] text-sm">{d.kind}</span></Row>)}
        </Section>
      ) : null}

      {bookings.length > 0 ? (
        <Section title="Upcoming bookings">
          {bookings.map((b) => (
            <BookingManage key={b.id} slug={slug} token={token} bookingId={b.id} label={formatDate(b.starts_at, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} canChange={withinChangeWindow(new Date(b.starts_at), booking.cancelWindowHours)} />
          ))}
        </Section>
      ) : null}

      <p className="mt-10 text-xs text-[var(--site-ink-2)]">Questions? Email {studio.name} at <a href={`mailto:${studio.email}`} className="underline">{studio.email}</a>.</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--site-ink-2)] mb-1">{title}</h2>
      <div className="rounded-xl border border-[var(--site-line)] px-4">{children}</div>
    </section>
  );
}
function Row({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="flex items-center justify-between border-b border-[var(--site-line)] py-3 text-sm last:border-0 hover:opacity-80">{children}</Link>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-sm text-[var(--site-ink-2)]">{children}</p>;
}
