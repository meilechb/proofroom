/**
 * Plan catalog and billing state.
 *
 * There is exactly one plan: $40 per month, everything included, unlimited
 * seats, 14-day trial without a card. No feature is gated by plan. This file
 * keeps a `plan` string on the studio so tiers can be added later without a
 * rewrite, but nothing reads limits or feature flags from it.
 *
 * Keep this file dependency-free: it is imported by client components, server
 * code and scripts/stripe-setup.mjs mirrors PLAN.
 */

export type PlanId = "studio";

export const PLAN = {
  id: "studio" as PlanId,
  name: "Studio",
  tagline: "Everything included. Unlimited seats. Cancel any time.",
  /** USD cents per month. */
  monthlyCents: 4000,
  /** Stripe price lookup key, stable across environments. */
  lookupKey: "studio_monthly",
  priceEnvName: "STRIPE_PRICE_STUDIO_MONTHLY",
  highlights: [
    "Client galleries with favorites and per-photo notes",
    "Two-way Lightroom Classic plugin",
    "Deposits, balances and e-signed agreements paid into your own Stripe",
    "0% commission, we never touch your money",
    "Website from a template, on your own domain",
    "CRM: inbox, clients, sessions, tasks, calendar",
    "Email from your own domain, with automations",
    "Team headshot days with per-person galleries",
    "Booking page, import from other tools",
    "Unlimited team members",
  ],
};

export const TRIAL_DAYS = 14;
/** After the trial ends unpaid, galleries and the website stay live this long. */
export const GRACE_DAYS = 30;
/** After cancellation, data is kept this long before purge. */
export const RETENTION_DAYS = 90;

export function formatPrice(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

export type StudioBillingFields = {
  plan: string;
  trial_ends_at: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end?: boolean | null;
  suspended_at?: string | null;
  read_only_since?: string | null;
  grace_ends_at?: string | null;
  plan_override?: string | null;
};

export type BillingStatus =
  /** In the free trial, no subscription yet. */
  | "trialing"
  /** Paying (or comped by platform admin). */
  | "active"
  /** Subscription exists but the last payment failed. Writes still allowed for now. */
  | "past_due"
  /** Trial ended (or subscription ended) with no payment. Writes blocked, galleries live until grace ends. */
  | "read_only"
  /** Grace over: galleries locked, data kept until retention ends. */
  | "locked";

export type BillingState = {
  status: BillingStatus;
  trialing: boolean;
  trialDaysLeft: number;
  /** True when the studio is suspended by the platform (separate from billing). */
  suspended: boolean;
  /** True when a Stripe subscription is set to end at the period end. */
  cancelling: boolean;
  /** When galleries lock if nothing is paid (only while read_only). */
  graceEndsAt: Date | null;
  /** Studio may create and edit things. */
  canWrite: boolean;
  /** Published galleries and the website are served to clients. */
  publicLive: boolean;
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);
const PAST_DUE_STATUSES = new Set(["past_due", "unpaid", "incomplete"]);

function daysBetween(later: Date, earlier: Date) {
  return Math.max(0, Math.ceil((later.getTime() - earlier.getTime()) / 86400000));
}

/**
 * Derives the studio's billing state from its stored columns. Pure, so it can
 * be unit tested and used from client components.
 */
export function billingState(studio: StudioBillingFields, now = new Date()): BillingState {
  const suspended = Boolean(studio.suspended_at);
  const cancelling = Boolean(studio.cancel_at_period_end);
  const trialEnd = studio.trial_ends_at ? new Date(studio.trial_ends_at) : null;
  const sub = studio.subscription_status ?? null;

  if (studio.plan_override === "comped" || (sub && ACTIVE_STATUSES.has(sub))) {
    return { status: "active", trialing: false, trialDaysLeft: 0, suspended, cancelling, graceEndsAt: null, canWrite: !suspended, publicLive: !suspended };
  }
  if (sub && PAST_DUE_STATUSES.has(sub)) {
    return { status: "past_due", trialing: false, trialDaysLeft: 0, suspended, cancelling, graceEndsAt: null, canWrite: !suspended, publicLive: !suspended };
  }
  if (!sub && trialEnd && trialEnd > now) {
    return {
      status: "trialing",
      trialing: true,
      trialDaysLeft: daysBetween(trialEnd, now),
      suspended,
      cancelling: false,
      graceEndsAt: null,
      canWrite: !suspended,
      publicLive: !suspended,
    };
  }
  // No active subscription and no running trial: read-only, then locked.
  const readOnlySince = studio.read_only_since ? new Date(studio.read_only_since) : trialEnd ?? now;
  const graceEndsAt = studio.grace_ends_at ? new Date(studio.grace_ends_at) : new Date(readOnlySince.getTime() + GRACE_DAYS * 86400000);
  const locked = graceEndsAt <= now;
  return {
    status: locked ? "locked" : "read_only",
    trialing: false,
    trialDaysLeft: 0,
    suspended,
    cancelling,
    graceEndsAt,
    canWrite: false,
    publicLive: !locked && !suspended,
  };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${units[i]}`;
}
