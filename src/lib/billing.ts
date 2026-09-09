import "server-only";

import type Stripe from "stripe";
import { db, one } from "@/lib/db";
import { GRACE_DAYS, PLAN } from "@/lib/plans";
import { referralCouponId, stripe, subscriptionPriceId } from "@/lib/stripe";
import type { Studio } from "@/lib/types";
import { log } from "@/lib/logger";

/**
 * The platform's own subscription: one price, $40/month, 14-day trial without
 * a card. This is the only money the platform ever touches. Client payments
 * live in payments.ts and run on the studio's Stripe account.
 */

type BillingStudio = Pick<Studio, "id" | "name" | "email" | "slug" | "stripe_customer_id" | "trial_ends_at">;

/** Creates the Stripe customer for a studio once and stores its id. */
export async function ensureCustomer(studio: BillingStudio): Promise<string> {
  if (studio.stripe_customer_id) return studio.stripe_customer_id;
  const customer = await stripe().customers.create({
    email: studio.email,
    name: studio.name,
    metadata: { studio_id: studio.id, studio_slug: studio.slug },
  });
  // Another request may have won the race; keep whichever id landed first.
  const row = one<{ stripe_customer_id: string }>(
    await db()`
      update studios set stripe_customer_id = coalesce(stripe_customer_id, ${customer.id})
      where id = ${studio.id}
      returning stripe_customer_id`
  );
  if (row && row.stripe_customer_id !== customer.id) {
    await stripe().customers.del(customer.id).catch(() => undefined);
    return row.stripe_customer_id;
  }
  return customer.id;
}

/** Stripe requires trial_end to be at least 48 hours in the future. */
const MIN_TRIAL_REMAINING_MS = 48 * 3600 * 1000;

export function remainingTrialEnd(trialEndsAt: string | null, now = new Date()): number | undefined {
  if (!trialEndsAt) return undefined;
  const end = new Date(trialEndsAt).getTime();
  if (end - now.getTime() < MIN_TRIAL_REMAINING_MS) return undefined;
  return Math.floor(end / 1000);
}

export async function createSubscriptionCheckout(
  studio: BillingStudio,
  urls: { successUrl: string; cancelUrl: string },
  options: { applyReferralCoupon?: boolean } = {}
) {
  const customer = await ensureCustomer(studio);
  const trialEnd = remainingTrialEnd(studio.trial_ends_at);
  const coupon = options.applyReferralCoupon ? referralCouponId() : null;
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: studio.id,
    line_items: [{ price: subscriptionPriceId(), quantity: 1 }],
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
    metadata: { studio_id: studio.id },
    subscription_data: {
      metadata: { studio_id: studio.id },
      description: `${PLAN.name} plan`,
      ...(trialEnd
        ? { trial_end: trialEnd, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } }
        : {}),
    },
    // Stripe accepts at most one discount and it cannot be combined with promotion codes.
    ...(coupon ? { discounts: [{ coupon }] } : { allow_promotion_codes: true }),
  });
  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  return session.url;
}

export async function createPortalSession(studio: BillingStudio, returnUrl: string) {
  const customer = await ensureCustomer(studio);
  const session = await stripe().billingPortal.sessions.create({ customer, return_url: returnUrl });
  return session.url;
}

/** The columns a Stripe subscription maps to on the studio row. Pure, for tests. */
export type SubscriptionSnapshot = {
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  subscription_status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export function subscriptionSnapshot(sub: Stripe.Subscription): SubscriptionSnapshot {
  // In current API versions the period lives on the subscription items.
  const periodEnd = sub.items?.data?.[0]?.current_period_end;
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  return {
    stripe_subscription_id: sub.id,
    stripe_customer_id: customer,
    subscription_status: sub.status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
  };
}

const ACTIVE = new Set(["active", "trialing"]);

/** Writes a subscription snapshot to the studio identified by metadata or customer id. */
export async function applySubscription(sub: Stripe.Subscription) {
  const snap = subscriptionSnapshot(sub);
  const studioId = sub.metadata?.studio_id || (await studioIdForCustomer(snap.stripe_customer_id));
  if (!studioId) {
    log.warn("billing.subscription_without_studio", { subscription: sub.id });
    return null;
  }
  const active = ACTIVE.has(snap.subscription_status);
  await db()`
    update studios set
      stripe_subscription_id = ${snap.stripe_subscription_id},
      stripe_customer_id = coalesce(stripe_customer_id, ${snap.stripe_customer_id}),
      subscription_status = ${snap.subscription_status},
      current_period_end = ${snap.current_period_end},
      cancel_at_period_end = ${snap.cancel_at_period_end},
      read_only_since = case when ${active} then null else read_only_since end,
      grace_ends_at = case when ${active} then null else grace_ends_at end
    where id = ${studioId}`;
  return studioId;
}

/** When a subscription is deleted (cancelled and ended), the studio becomes read-only with the usual grace period. */
export async function applySubscriptionDeleted(sub: Stripe.Subscription) {
  const studioId = sub.metadata?.studio_id || (await studioIdForCustomer(typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null));
  if (!studioId) return null;
  await db()`
    update studios set
      subscription_status = 'canceled',
      cancel_at_period_end = false,
      read_only_since = coalesce(read_only_since, now()),
      grace_ends_at = coalesce(grace_ends_at, now() + (${GRACE_DAYS} || ' days')::interval)
    where id = ${studioId}`;
  return studioId;
}

export async function studioIdForCustomer(customerId: string | null) {
  if (!customerId) return null;
  const row = one<{ id: string }>(await db()`select id from studios where stripe_customer_id = ${customerId} limit 1`);
  return row?.id ?? null;
}

/** The subscription id an invoice belongs to, across API versions. */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

/** True for the first real charge of a subscription (not a $0 trial invoice). */
export function isFirstPaidInvoice(invoice: Stripe.Invoice) {
  return invoice.billing_reason === "subscription_create" || invoice.billing_reason === "subscription_cycle"
    ? invoice.amount_paid > 0 && invoice.billing_reason === "subscription_create"
    : false;
}

/**
 * Cron: studios whose trial ended with no subscription become read-only, with
 * galleries live until grace_ends_at. Idempotent.
 */
export async function markExpiredTrialsReadOnly() {
  const rows = await db()`
    update studios set
      read_only_since = trial_ends_at,
      grace_ends_at = trial_ends_at + (${GRACE_DAYS} || ' days')::interval
    where deleted_at is null
      and read_only_since is null
      and subscription_status is null
      and plan_override is null
      and trial_ends_at is not null and trial_ends_at < now()
    returning id`;
  return rows.length;
}
