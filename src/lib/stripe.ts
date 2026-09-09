import "server-only";

import Stripe from "stripe";
import { env } from "@/lib/env";
import type { Interval, PlanId } from "@/lib/plans";
import { priceEnvName } from "@/lib/plans";

let client: Stripe | null = null;

/** Platform Stripe client. Lazily constructed so builds without keys succeed. */
export function stripe() {
  if (!client) {
    const key = env.stripeSecretKey();
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
    client = new Stripe(key, { appInfo: { name: "Proofroom", url: "https://proofroom.com" } });
  }
  return client;
}

/** Options to run a call on a connected account (direct charges). */
export function onAccount(accountId: string): Stripe.RequestOptions {
  return { stripeAccount: accountId };
}

export function priceId(plan: PlanId, interval: Interval): string {
  const name = priceEnvName(plan, interval);
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is not set. Run: npm run stripe:setup`);
  return v;
}

/** Reverse lookup: which plan/interval does a Stripe price id belong to. */
export function planFromPriceId(id: string): { plan: PlanId; interval: Interval } | null {
  const plans: PlanId[] = ["starter", "pro", "studio"];
  const intervals: Interval[] = ["month", "year"];
  for (const plan of plans) {
    for (const interval of intervals) {
      if (process.env[priceEnvName(plan, interval)]?.trim() === id) return { plan, interval };
    }
  }
  return null;
}
