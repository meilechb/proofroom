#!/usr/bin/env node
// Creates (or finds) the subscription products and prices in Stripe and prints
// the STRIPE_PRICE_* lines to paste into Vercel. Idempotent via lookup keys.
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY (platform account) before running this script.");
  process.exit(1);
}
const stripe = new Stripe(key);

// Mirror of src/lib/plans.ts (kept in sync by tests/plans.test.ts).
const PLANS = [
  { id: "starter", name: "Proofroom Starter", monthly: 12, yearly: 120 },
  { id: "pro", name: "Proofroom Pro", monthly: 24, yearly: 240 },
  { id: "studio", name: "Proofroom Studio", monthly: 49, yearly: 480 },
];

const lines = [];
for (const plan of PLANS) {
  let product = (await stripe.products.search({ query: `metadata['proofroom_plan']:'${plan.id}'` })).data[0];
  if (!product) {
    product = await stripe.products.create({ name: plan.name, metadata: { proofroom_plan: plan.id } });
    console.log(`created product ${product.id} (${plan.name})`);
  }
  for (const [interval, amount] of [["month", plan.monthly], ["year", plan.yearly]]) {
    const lookup_key = `proofroom_${plan.id}_${interval}`;
    let price = (await stripe.prices.list({ lookup_keys: [lookup_key], limit: 1 })).data[0];
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: amount * 100,
        recurring: { interval },
        lookup_key,
        metadata: { proofroom_plan: plan.id, interval },
      });
      console.log(`created price ${price.id} (${lookup_key})`);
    }
    lines.push(`STRIPE_PRICE_${plan.id.toUpperCase()}_${interval === "month" ? "MONTHLY" : "YEARLY"}=${price.id}`);
  }
}

// Customer Portal: allow plan switching between the prices above.
console.log("\nAdd these to Vercel → Environment Variables:\n");
console.log(lines.join("\n"));
console.log("\nThen in Stripe Dashboard → Settings → Billing → Customer portal, enable\n\"Customers can switch plans\" and select the six prices above.");
