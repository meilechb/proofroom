import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { formatPrice, formatBytes, PLANS, PRO_SEAT_CENTS, entitlements } from "@/lib/plans";
import { stripe } from "@/lib/stripe";
import { configured } from "@/lib/env";
import { getUsage } from "@/lib/usage";
import { formatDate } from "@/lib/types";
import { Badge, Card, Notice, PageHeader, Stat } from "@/components/ui";
import { pendingRewardFor } from "@/lib/referrals-server";
import { REFERRAL_REWARD_TEXT } from "@/lib/referrals";

export const metadata: Metadata = { title: "Billing" };

type InvoiceRow = { id: string; number: string | null; created: number; total: number; currency: string; status: string | null; hosted_invoice_url: string | null; invoice_pdf: string | null };

export default async function BillingPage({ searchParams }: PageProps<"/studio/billing">) {
  const ctx = await requireStudioPage("admin");
  const sp = await searchParams;
  const { studio, billing } = ctx;
  const usage = await getUsage(studio.id);
  const pendingReward = await pendingRewardFor(studio.id);
  let invoices: InvoiceRow[] = [];
  let card: string | null = null;
  if (configured.stripe() && studio.stripe_customer_id) {
    try {
      const [list, customer] = await Promise.all([
        stripe().invoices.list({ customer: studio.stripe_customer_id, limit: 12 }),
        stripe().customers.retrieve(studio.stripe_customer_id, { expand: ["invoice_settings.default_payment_method"] }),
      ]);
      invoices = list.data.map((i) => ({ id: i.id, number: i.number, created: i.created, total: i.total, currency: i.currency, status: i.status, hosted_invoice_url: i.hosted_invoice_url ?? null, invoice_pdf: i.invoice_pdf ?? null }));
      const pm = !("deleted" in customer) ? customer.invoice_settings?.default_payment_method : null;
      if (pm && typeof pm !== "string" && pm.card) card = `${pm.card.brand.toUpperCase()} •••• ${pm.card.last4}`;
    } catch {
      invoices = [];
    }
  }

  const ent = entitlements(billing.effectivePlan);
  const onPro = billing.effectivePlan === "pro";
  const seats = Math.max(1, usage.members);
  const perSeat = formatPrice(PRO_SEAT_CENTS);
  const monthlyTotal = formatPrice(seats * PRO_SEAT_CENTS);
  const planName = PLANS[billing.effectivePlan].name;
  const storageValue = ent.storageBytes === null ? formatBytes(usage.storageBytes) : `${formatBytes(usage.storageBytes)} / ${formatBytes(ent.storageBytes)}`;
  const storageHint = ent.storageBytes === null ? "No cap. Fair use." : "Free plan limit";

  const statusBadge = {
    trialing: <Badge tone="brand">Pro trial, {billing.trialDaysLeft} day{billing.trialDaysLeft === 1 ? "" : "s"} left</Badge>,
    active: <Badge tone="success">{billing.cancelling ? "Pro, cancels at period end" : "Pro, active"}</Badge>,
    past_due: <Badge tone="warning">Payment failed</Badge>,
    free: <Badge tone="neutral">Free plan</Badge>,
    read_only: <Badge tone="danger">Read-only</Badge>,
    locked: <Badge tone="danger">Galleries locked</Badge>,
  }[billing.status];

  const headerDescription = onPro
    ? `Pro — ${perSeat} per seat, per month. Cancel any time.`
    : `You're on the Free plan. Upgrade to Pro (${perSeat} per seat) for your whole team, a custom domain, your own email domain, automations, booking and more.`;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Billing" description={headerDescription} />
      {sp.error === "checkout" ? <Notice tone="danger" className="mb-4">We could not start checkout. Try again, or contact support if it keeps happening.</Notice> : null}
      {sp.error === "portal" ? <Notice tone="danger" className="mb-4">We could not open the billing portal. Try again in a moment.</Notice> : null}
      {sp.cancelled === "1" ? <Notice className="mb-4">Checkout was cancelled. Nothing changed.</Notice> : null}
      {!configured.stripe() ? <Notice tone="warning" className="mb-4">Stripe is not configured on this deployment yet, so subscribing is unavailable here.</Notice> : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Status</p>
            <div className="mt-1">{statusBadge}</div>
          </div>
          <div className="flex gap-2">
            {billing.status === "trialing" || billing.status === "free" ? (
              <form action="/api/billing/checkout" method="post"><button className="btn-primary" disabled={!configured.stripe()}>{billing.status === "trialing" ? "Start Pro subscription" : "Upgrade to Pro"}</button></form>
            ) : null}
            {studio.stripe_customer_id && (billing.status === "active" || billing.status === "past_due") ? (
              <form action="/api/billing/portal" method="post"><button className="btn-secondary">Manage billing</button></form>
            ) : null}
          </div>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
          <div><dt className="text-muted">Plan</dt><dd className="font-medium">{planName}{onPro ? `, ${perSeat}/seat` : ""}</dd></div>
          {onPro ? (
            <div><dt className="text-muted">Seats</dt><dd className="font-medium">{seats} × {perSeat} = {monthlyTotal}/mo</dd></div>
          ) : (
            <div><dt className="text-muted">Your team on Pro</dt><dd className="font-medium">{seats} seat{seats === 1 ? "" : "s"} = {monthlyTotal}/mo</dd></div>
          )}
          <div><dt className="text-muted">{billing.status === "trialing" ? "Trial ends" : billing.cancelling ? "Ends" : onPro ? "Next invoice" : "Card"}</dt><dd className="font-medium">{billing.status === "trialing" ? formatDate(studio.trial_ends_at) : onPro ? (formatDate(studio.current_period_end) || "—") : (card ?? "None on file")}</dd></div>
        </dl>
        {pendingReward ? <Notice tone="success" className="mt-4">A referral reward is waiting: {REFERRAL_REWARD_TEXT} is applied when you upgrade to Pro.</Notice> : null}
        {billing.status === "trialing" ? <Notice className="mt-4">Your Pro trial has all features. When it ends, your studio moves to the Free plan (1 seat, {formatBytes(entitlements("free").storageBytes ?? 0)} storage) unless you subscribe — your galleries and website stay live either way.</Notice> : null}
        {billing.status === "free" ? <Notice className="mt-4">Free includes client galleries, proofing, payments into your own Stripe and the Lightroom plugin, with a {formatBytes(entitlements("free").storageBytes ?? 0)} storage limit and 1 seat. Upgrade to Pro to add your team and unlock the rest.</Notice> : null}
        {billing.status === "past_due" ? <Notice tone="warning" className="mt-4">The last payment failed. Stripe retries over a few days; update the card in Manage billing to avoid moving to the Free plan.</Notice> : null}
        {onPro && billing.cancelling ? <Notice tone="warning" className="mt-4">Your subscription cancels at the period end. You&apos;ll move to the Free plan then — your data stays. Resume any time in Manage billing.</Notice> : null}
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Storage used" value={storageValue} hint={storageHint} />
        <Stat label="Live galleries" value={usage.activeGalleries} />
        <Stat label="Team members" value={seats} hint={onPro ? `${perSeat} each / month` : "1 on Free"} />
      </div>

      <Card className="mt-6">
        <h2 className="font-medium">What is included in {planName}</h2>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2 text-sm text-ink-2">
          {PLANS[billing.effectivePlan].highlights.map((h) => <li key={h}>· {h}</li>)}
        </ul>
      </Card>

      {invoices.length > 0 ? (
        <Card className="mt-6" pad={false}>
          <div className="px-5 pt-5 pb-2"><h2 className="font-medium">Invoices</h2></div>
          <table className="w-full text-sm">
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-t border-line">
                  <td className="px-5 py-2">{formatDate(new Date(i.created * 1000).toISOString())}</td>
                  <td className="px-5 py-2">{i.number ?? i.id}</td>
                  <td className="px-5 py-2">{formatPrice(i.total, i.currency)}</td>
                  <td className="px-5 py-2"><Badge tone={i.status === "paid" ? "success" : i.status === "open" ? "warning" : "neutral"}>{i.status ?? "—"}</Badge></td>
                  <td className="px-5 py-2 text-right">{i.invoice_pdf ? <a href={i.invoice_pdf} className="underline" target="_blank" rel="noreferrer">PDF</a> : i.hosted_invoice_url ? <a href={i.hosted_invoice_url} className="underline" target="_blank" rel="noreferrer">View</a> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}
