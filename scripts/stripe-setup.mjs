#!/usr/bin/env node
// Creates (or finds) everything the platform needs in Stripe and prints the env
// lines to paste into Vercel. Idempotent: safe to run again.
//   - one product "Pro" with one recurring per-seat price, $18/seat/month, lookup key pro_seat_monthly
//   - the referral coupon (10% off for 12 months), id referral_10_12mo
//   - when NEXT_PUBLIC_APP_URL is set to a public https URL: the two webhook
//     endpoints (account events and connected-account events)
//
//   STRIPE_SECRET_KEY=sk_test_... NEXT_PUBLIC_APP_URL=https://app.example.com node scripts/stripe-setup.mjs
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY (platform account) before running this script.");
  process.exit(1);
}
const stripe = new Stripe(key);
const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Proofroom";
const lines = [];

// 1. Product and per-seat price. Mirrors src/lib/plans.ts PLANS.pro.
// Stripe bills quantity * unit_amount, so quantity = seat count (see billing.ts).
const PRO = { id: "pro", name: `${appName} Pro`, seatCents: 1800, lookupKey: "pro_seat_monthly" };

let product = (await stripe.products.search({ query: `metadata['app_plan']:'${PRO.id}'` })).data[0];
if (!product) {
  product = await stripe.products.create({
    name: PRO.name,
    description: "Everything, for your whole team. Billed per seat. Cancel any time.",
    metadata: { app_plan: PRO.id },
  });
  console.log(`created product ${product.id} (${PRO.name})`);
} else {
  console.log(`found product ${product.id} (${product.name})`);
}

let price = (await stripe.prices.list({ lookup_keys: [PRO.lookupKey], limit: 1 })).data[0];
if (!price) {
  price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: PRO.seatCents,
    recurring: { interval: "month" },
    lookup_key: PRO.lookupKey,
    metadata: { app_plan: PRO.id },
  });
  console.log(`created price ${price.id} (${PRO.lookupKey})`);
} else {
  console.log(`found price ${price.id} (${PRO.lookupKey})`);
  if (price.unit_amount !== PRO.seatCents) {
    console.warn(`  warning: existing price is ${price.unit_amount} cents, plans.ts says ${PRO.seatCents}. Prices are immutable in Stripe; create a new one and move the lookup key if you meant to change it.`);
  }
}
lines.push(`STRIPE_PRICE_PRO_SEAT_MONTHLY=${price.id}`);

// 2. Referral coupon (plan item 1.15): 10% off, repeating for 12 months.
const COUPON_ID = "referral_10_12mo";
let coupon = null;
try {
  coupon = await stripe.coupons.retrieve(COUPON_ID);
  console.log(`found coupon ${coupon.id}`);
} catch (err) {
  if (err?.code !== "resource_missing") throw err;
}
if (!coupon) {
  coupon = await stripe.coupons.create({
    id: COUPON_ID,
    name: "Referral: 10% off for 12 months",
    percent_off: 10,
    duration: "repeating",
    duration_in_months: 12,
    metadata: { app_purpose: "referral" },
  });
  console.log(`created coupon ${coupon.id}`);
}
lines.push(`STRIPE_REFERRAL_COUPON_ID=${coupon.id}`);

// 3. Webhook endpoints (plan item 1.16), only for a public https app URL.
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
const ENDPOINTS = [
  {
    path: "/api/stripe/webhook",
    connect: false,
    description: `${appName}: platform account events (subscriptions)`,
    envName: "STRIPE_WEBHOOK_SECRET",
    enabled_events: [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed",
    ],
  },
  {
    path: "/api/stripe/connect-webhook",
    connect: true,
    description: `${appName}: connected account events (client payments)`,
    envName: "STRIPE_CONNECT_WEBHOOK_SECRET",
    enabled_events: [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "charge.refunded",
      "charge.dispute.created",
      "charge.dispute.closed",
      "account.updated",
      "account.application.deauthorized",
    ],
  },
];

if (appUrl && appUrl.startsWith("https://")) {
  const existing = (await stripe.webhookEndpoints.list({ limit: 100 })).data;
  for (const ep of ENDPOINTS) {
    const url = appUrl + ep.path;
    const found = existing.find((e) => e.url === url);
    if (found) {
      console.log(`found webhook ${found.id} (${url}); its secret is only shown at creation, keep the one you have`);
      continue;
    }
    const created = await stripe.webhookEndpoints.create({
      url,
      description: ep.description,
      enabled_events: ep.enabled_events,
      connect: ep.connect,
    });
    console.log(`created webhook ${created.id} (${url})`);
    lines.push(`${ep.envName}=${created.secret}`);
  }
} else {
  console.log("\nNEXT_PUBLIC_APP_URL is not a public https URL; skipping webhook endpoints.");
  console.log("Create them in Stripe → Workbench → Webhooks (see docs/BUILD-PLAN.md Appendix A), or rerun with the URL set.");
}

console.log("\nAdd these to Vercel → Environment Variables (saas project):\n");
console.log(lines.join("\n"));
console.log(`
Then in Stripe Dashboard → Settings → Billing → Customer portal:
  allow customers to update payment methods and cancel subscriptions; leave plan switching off.
For client payments, complete the Connect platform profile and OAuth settings (Appendix A).`);
