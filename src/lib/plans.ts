/**
 * Plan catalog, entitlements and billing state.
 *
 * Two tiers:
 *  - free: 1 seat, a 5 GB storage cap, feature-gated. Keeps client payments
 *    (own Stripe, 0%) and the Lightroom plugin.
 *  - pro: $18 per seat / month (per-seat Stripe quantity), everything, uncapped.
 *
 * A new studio trials full Pro for 14 days, then downgrades to Free (not
 * read-only) if it hasn't subscribed. `billingState()` maps the stored columns
 * to a status and an `effectivePlan`; `entitlements(effectivePlan)` is the gate
 * the rest of the app reads.
 *
 * Keep this file dependency-free: it is imported by client components, server
 * code and scripts/stripe-setup.mjs.
 */

export type PlanId = "free" | "pro";

/** Free-tier storage cap (D2). One number to tune. */
export const FREE_STORAGE_BYTES = 5 * 1024 ** 3;
/** Pro price per seat per month, USD cents. */
export const PRO_SEAT_CENTS = 1800;

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  highlights: string[];
  /** USD cents per seat per month (pro only). */
  pricePerSeatCents?: number;
  /** Stripe price lookup key, stable across environments (pro only). */
  lookupKey?: string;
  priceEnvName?: string;
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "For solo photographers getting started. Free forever.",
    highlights: [
      "Client galleries with favorites and per-photo notes",
      "Two-way Lightroom Classic plugin",
      "Deposits, balances and e-signed agreements paid into your own Stripe",
      "0% commission, we never touch your money",
      "A website on a free subdomain",
      "CRM: inbox, clients, sessions, tasks",
      "5 GB of storage",
      "1 user",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Everything, for your whole team. $18 per seat, per month.",
    pricePerSeatCents: PRO_SEAT_CENTS,
    lookupKey: "pro_seat_monthly",
    priceEnvName: "STRIPE_PRICE_PRO_SEAT_MONTHLY",
    highlights: [
      "Everything in Free, plus:",
      "Your whole team, billed per seat",
      "Your own domain for the website and client emails",
      "Email automations and broadcasts",
      "Booking page and import from other tools",
      "Session planning: shot lists and mood boards",
      "Uncapped storage (fair use)",
      "No platform badge on your galleries or site",
    ],
  },
};

/**
 * @deprecated Transitional alias for the pre-existing single-plan callers.
 * Consumers migrate to `PLANS`/`entitlements` in later phases of the pricing
 * change; this shim keeps the old value/shape so the build stays green until
 * each caller is updated, then it is removed.
 */
export const PLAN = {
  id: "pro" as PlanId,
  name: "Studio",
  tagline: "Everything included. Unlimited seats. Cancel any time.",
  monthlyCents: 4000,
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

/**
 * Per-plan feature limits and flags. This is the gate the app reads; nothing
 * else should branch on plan identity directly.
 */
export type Entitlements = {
  /** null = uncapped (fair use); a byte count = hard cap on new uploads. */
  storageBytes: number | null;
  /** null = unlimited seats; a number = hard cap on team members. */
  maxSeats: number | null;
  customDomain: boolean;
  sendingDomain: boolean;
  /** Email automations and broadcasts. */
  automations: boolean;
  booking: boolean;
  imports: boolean;
  sessionPlanning: boolean;
  /** When false, galleries and the public site show a platform badge. */
  removeBranding: boolean;
  referralReward: boolean;
  /** Client payments via the studio's own Stripe. True on both tiers. */
  payments: boolean;
  /** Lightroom Classic plugin. True on both tiers. */
  lightroom: boolean;
  /** The online store: sell images, packages and licences. Pro only. */
  store: boolean;
};

export const FREE_ENTITLEMENTS: Entitlements = {
  storageBytes: FREE_STORAGE_BYTES,
  maxSeats: 1,
  customDomain: false,
  sendingDomain: false,
  automations: false,
  booking: false,
  imports: false,
  sessionPlanning: false,
  removeBranding: false,
  referralReward: false,
  payments: true,
  lightroom: true,
  store: false,
};

export const PRO_ENTITLEMENTS: Entitlements = {
  storageBytes: null,
  maxSeats: null,
  customDomain: true,
  sendingDomain: true,
  automations: true,
  booking: true,
  imports: true,
  sessionPlanning: true,
  removeBranding: true,
  referralReward: true,
  payments: true,
  lightroom: true,
  store: true,
};

export function entitlements(plan: PlanId): Entitlements {
  return plan === "pro" ? PRO_ENTITLEMENTS : FREE_ENTITLEMENTS;
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
  /** In the free 14-day Pro trial, no subscription yet. */
  | "trialing"
  /** Paying for Pro (or comped by platform admin). */
  | "active"
  /** Pro subscription exists but the last payment failed. Writes still allowed. */
  | "past_due"
  /** On the Free plan (trial lapsed or subscription ended). Writable, feature-gated. */
  | "free"
  /** Legacy states, no longer produced by the trial path; kept so older UI compiles. */
  | "read_only"
  | "locked";

export type BillingState = {
  status: BillingStatus;
  /** The stored plan on the studio row. */
  plan: PlanId;
  /** The plan whose entitlements apply now (pro while trialing/active/past_due). */
  effectivePlan: PlanId;
  trialing: boolean;
  trialDaysLeft: number;
  /** True when the studio is suspended by the platform (separate from billing). */
  suspended: boolean;
  /** True when a Stripe subscription is set to end at the period end. */
  cancelling: boolean;
  /** Retained for compatibility; null on the Free path. */
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

function coercePlan(plan: string | null | undefined): PlanId {
  return plan === "pro" ? "pro" : "free";
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
  const storedPlan = coercePlan(studio.plan);

  const base = { plan: storedPlan, suspended, cancelling, graceEndsAt: null as Date | null };

  if (studio.plan_override === "comped" || (sub && ACTIVE_STATUSES.has(sub))) {
    return { ...base, status: "active", effectivePlan: "pro", trialing: false, trialDaysLeft: 0, canWrite: !suspended, publicLive: !suspended };
  }
  if (sub && PAST_DUE_STATUSES.has(sub)) {
    return { ...base, status: "past_due", effectivePlan: "pro", trialing: false, trialDaysLeft: 0, canWrite: !suspended, publicLive: !suspended };
  }
  if (!sub && trialEnd && trialEnd > now) {
    return { ...base, status: "trialing", effectivePlan: "pro", trialing: true, trialDaysLeft: daysBetween(trialEnd, now), cancelling: false, canWrite: !suspended, publicLive: !suspended };
  }
  // Trial lapsed (or subscription ended) and not comped: the studio is on Free.
  // Writable and public, just feature-gated by entitlements("free").
  return { ...base, status: "free", effectivePlan: "free", trialing: false, trialDaysLeft: 0, canWrite: !suspended, publicLive: !suspended };
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
