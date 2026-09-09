/**
 * Plan catalog. Prices are the public prices shown on /pricing and used by
 * scripts/stripe-setup.mjs to create Stripe products. Limits are enforced by
 * entitlements(). Keep this file dependency-free: it is imported by client
 * components, server code and the setup script.
 */

export type PlanId = "free" | "starter" | "pro" | "studio";
export type Interval = "month" | "year";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** USD per month when billed monthly / yearly (per month equivalent). */
  monthly: number;
  yearlyPerMonth: number;
  storageGb: number;
  /** -1 = unlimited */
  activeGalleries: number;
  members: number;
  features: {
    customDomain: boolean;
    removeBranding: boolean;
    teamEvents: boolean;
    contracts: boolean;
    lightroomSync: boolean;
    prioritySupport: boolean;
    apiTokens: number;
  };
  highlights: string[];
};

const GB = 1024 ** 3;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Try the whole workflow with a few clients.",
    monthly: 0,
    yearlyPerMonth: 0,
    storageGb: 2,
    activeGalleries: 3,
    members: 1,
    features: {
      customDomain: false,
      removeBranding: false,
      teamEvents: false,
      contracts: true,
      lightroomSync: true,
      prioritySupport: false,
      apiTokens: 1,
    },
    highlights: [
      "2 GB storage, 3 live galleries",
      "Favorites and per-photo notes",
      "Deposits, balances and e-signed agreements",
      "Lightroom plugin with favorites and notes sync",
      "0% commission on client payments",
      `"Powered by" badge on galleries`,
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "For a working portrait or headshot photographer.",
    monthly: 12,
    yearlyPerMonth: 10,
    storageGb: 50,
    activeGalleries: -1,
    members: 1,
    features: {
      customDomain: false,
      removeBranding: true,
      teamEvents: false,
      contracts: true,
      lightroomSync: true,
      prioritySupport: false,
      apiTokens: 3,
    },
    highlights: [
      "50 GB storage, unlimited galleries",
      "Your logo and colors, no badge",
      "Client CRM with stages and next steps",
      "Editable email templates",
      "Everything in Free",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Custom domain, team headshot days and a second seat.",
    monthly: 24,
    yearlyPerMonth: 20,
    storageGb: 250,
    activeGalleries: -1,
    members: 3,
    features: {
      customDomain: true,
      removeBranding: true,
      teamEvents: true,
      contracts: true,
      lightroomSync: true,
      prioritySupport: false,
      apiTokens: 10,
    },
    highlights: [
      "250 GB storage",
      "Custom domain for galleries",
      "Team headshot events with per-person galleries",
      "3 team members",
      "Everything in Starter",
    ],
  },
  studio: {
    id: "studio",
    name: "Studio",
    tagline: "For multi-photographer studios and high volume.",
    monthly: 49,
    yearlyPerMonth: 40,
    storageGb: 1024,
    activeGalleries: -1,
    members: -1,
    features: {
      customDomain: true,
      removeBranding: true,
      teamEvents: true,
      contracts: true,
      lightroomSync: true,
      prioritySupport: true,
      apiTokens: -1,
    },
    highlights: ["1 TB storage", "Unlimited team members", "Priority support", "Audit log export", "Everything in Pro"],
  },
};

export const PAID_PLANS: PlanId[] = ["starter", "pro", "studio"];
export const PLAN_ORDER: PlanId[] = ["free", "starter", "pro", "studio"];
export const TRIAL_DAYS = 14;
export const TRIAL_PLAN: PlanId = "pro";

export function planRank(id: PlanId) {
  return PLAN_ORDER.indexOf(id);
}

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && v in PLANS;
}

export function priceEnvName(plan: PlanId, interval: Interval) {
  return `STRIPE_PRICE_${plan.toUpperCase()}_${interval === "month" ? "MONTHLY" : "YEARLY"}`;
}

/** Stripe lookup keys, stable across environments. */
export function priceLookupKey(plan: PlanId, interval: Interval) {
  return `proofroom_${plan}_${interval}`;
}

export type StudioBillingFields = {
  plan: string;
  trial_ends_at: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  suspended_at?: string | null;
};

export type Entitlements = {
  /** Plan whose limits currently apply (trial elevates a free studio to the trial plan). */
  effectivePlan: PlanId;
  /** Plan on record, regardless of trial. */
  plan: PlanId;
  trialing: boolean;
  trialDaysLeft: number;
  /** Subscription is past due or unpaid; keep read access, block new uploads. */
  delinquent: boolean;
  suspended: boolean;
  limits: {
    storageBytes: number;
    activeGalleries: number;
    members: number;
    apiTokens: number;
  };
  features: Plan["features"];
};

export function entitlements(studio: StudioBillingFields, now = new Date()): Entitlements {
  const plan: PlanId = isPlanId(studio.plan) ? studio.plan : "free";
  const trialEnd = studio.trial_ends_at ? new Date(studio.trial_ends_at) : null;
  const trialing = plan === "free" && Boolean(trialEnd && trialEnd > now);
  const trialDaysLeft = trialing && trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)) : 0;
  const effectivePlan: PlanId = trialing ? TRIAL_PLAN : plan;
  const p = PLANS[effectivePlan];
  const delinquent = plan !== "free" && ["past_due", "unpaid", "incomplete_expired"].includes(studio.subscription_status ?? "");
  return {
    effectivePlan,
    plan,
    trialing,
    trialDaysLeft,
    delinquent,
    suspended: Boolean(studio.suspended_at),
    limits: {
      storageBytes: p.storageGb * GB,
      activeGalleries: p.activeGalleries,
      members: p.members,
      apiTokens: p.features.apiTokens,
    },
    features: p.features,
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

/** True when `limit` is unlimited (-1) or `used` is strictly below it. */
export function withinLimit(used: number, limit: number) {
  return limit < 0 || used < limit;
}
