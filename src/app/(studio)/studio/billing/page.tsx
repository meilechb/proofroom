import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { formatPrice, GRACE_DAYS, PLAN, RETENTION_DAYS } from "@/lib/plans";
import { stripe } from "@/lib/stripe";
import { configured } from "@/lib/env";
import { getUsage } from "@/lib/usage";
import { formatBytes } from "@/lib/plans";
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
  const statusBadge = {
    trialing: <Badge tone="brand">Free trial, {billing.trialDaysLeft} day{billing.trialDaysLeft === 1 ? "" : "s"} left</Badge>,
    active: <Badge tone="success">{billing.cancelling ? "Active, cancels at period end" : "Active"}</Badge>,
    past_due: <Badge tone="warning">Payment failed</Badge>,
    free: <Badge tone="neutral">Free plan</Badge>,
    read_only: <Badge tone="danger">Read-only</Badge>,
    locked: <Badge tone="danger">Galleries locked</Badge>,
  }[billing.status];

  return (
    <div className="max-w-3xl">
      <PageHeader title="Billing" description={`${PLAN.name}: ${formatPrice(PLAN.monthlyCents)} a month. Everything included, unlimited team members, cancel any time.`} />
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
            {billing.status === "trialing" || billing.status === "free" || billing.status === "read_only" || billing.status === "locked" ? (
              <form action="/api/billing/checkout" method="post"><button className="btn-primary" disabled={!configured.stripe()}>{billing.status === "trialing" ? "Start your subscription" : "Upgrade to Pro"}</button></form>
            ) : null}
            {studio.stripe_customer_id && (billing.status === "active" || billing.status === "past_due") ? (
              <form action="/api/billing/portal" method="post"><button className="btn-secondary">Manage billing</button></form>
            ) : null}
          </div>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
          <div><dt className="text-muted">Plan</dt><dd className="font-medium">{PLAN.name}, {formatPrice(PLAN.monthlyCents)}/month</dd></div>
          <div><dt className="text-muted">{billing.status === "trialing" ? "Trial ends" : billing.cancelling ? "Access ends" : "Next invoice"}</dt><dd className="font-medium">{billing.status === "trialing" ? formatDate(studio.trial_ends_at) : formatDate(studio.current_period_end) || "—"}</dd></div>
          <div><dt className="text-muted">Card</dt><dd className="font-medium">{card ?? "None on file"}</dd></div>
        </dl>
        {pendingReward ? <Notice tone="success" className="mt-4">A referral reward is waiting: {REFERRAL_REWARD_TEXT} is applied when you subscribe.</Notice> : null}
        {billing.status === "read_only" ? <Notice tone="warning" className="mt-4">Your trial has ended. The studio is read-only; client galleries and your website stay live until {formatDate(billing.graceEndsAt?.toISOString() ?? null)} ({GRACE_DAYS} days after the trial). Subscribe to continue.</Notice> : null}
        {billing.status === "locked" ? <Notice tone="danger" className="mt-4">Client galleries are locked. Your data is kept for {RETENTION_DAYS} days after cancellation. Subscribe to unlock everything.</Notice> : null}
        {billing.status === "past_due" ? <Notice tone="warning" className="mt-4">The last payment failed. Stripe retries over a few days; update the card in Manage billing to avoid interruption.</Notice> : null}
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Storage used" value={formatBytes(usage.storageBytes)} hint="No cap. Fair use." />
        <Stat label="Live galleries" value={usage.activeGalleries} />
        <Stat label="Team members" value={usage.members} hint="Unlimited" />
      </div>

      <Card className="mt-6">
        <h2 className="font-medium">What is included</h2>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2 text-sm text-ink-2">
          {PLAN.highlights.map((h) => <li key={h}>· {h}</li>)}
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
