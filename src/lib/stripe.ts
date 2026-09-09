import "server-only";

import Stripe from "stripe";
import { APP_NAME, appUrl, env } from "@/lib/env";
import { PLAN } from "@/lib/plans";

let client: Stripe | null = null;

/** Platform Stripe client. Lazily constructed so builds without keys succeed. */
export function stripe() {
  if (!client) {
    const key = env.stripeSecretKey();
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
    client = new Stripe(key, { appInfo: { name: APP_NAME, url: appUrl() } });
  }
  return client;
}

/**
 * Options to run a call on a connected account. Used for every client payment:
 * the charge is created on the studio's own Stripe account (a direct charge),
 * with no application fee.
 */
export function onAccount(accountId: string): Stripe.RequestOptions {
  return { stripeAccount: accountId };
}

/** The one subscription price. */
export function subscriptionPriceId(): string {
  const v = process.env[PLAN.priceEnvName]?.trim();
  if (!v) throw new Error(`${PLAN.priceEnvName} is not set. Run: npm run stripe:setup`);
  return v;
}

/** Referral coupon (10% off for 12 months), created by stripe:setup. */
export function referralCouponId(): string | null {
  return env.referralCouponId() ?? null;
}

/** True when the platform keys are test keys; pay pages show a badge. */
export function isTestMode() {
  return (env.stripeSecretKey() ?? "").startsWith("sk_test_");
}
