#!/usr/bin/env node
// Lists the environment variables the app uses and which are missing, grouped by
// what stops working without them. Never prints values. Exit code 0 always, so it
// can run as a dev preflight without blocking.
//   node scripts/check-env.mjs
import { readFileSync, existsSync } from "node:fs";

// Load .env.local for local runs (Vercel injects variables in deployments).
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const GROUPS = [
  { name: "Core (app will not start correctly without these)", vars: ["NEXT_PUBLIC_APP_NAME", "NEXT_PUBLIC_APP_DOMAIN", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPPORT_EMAIL", "DATABASE_URL", "APP_SECRET"] },
  { name: "Storage (uploads, logos, documents)", vars: ["BLOB_READ_WRITE_TOKEN", "ASSETS_READ_WRITE_TOKEN"] },
  { name: "Platform billing (the $40/month subscription)", vars: ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_STUDIO_MONTHLY", "STRIPE_REFERRAL_COUPON_ID"] },
  { name: "Client payments (studios' own Stripe accounts)", vars: ["STRIPE_CONNECT_CLIENT_ID", "STRIPE_CONNECT_WEBHOOK_SECRET"] },
  { name: "Email", vars: ["RESEND_API_KEY", "EMAIL_FROM", "RESEND_WEBHOOK_SECRET"] },
  { name: "Scheduled jobs and alerts", vars: ["CRON_SECRET", "PLATFORM_ALERT_EMAIL"] },
  { name: "Optional: custom domains via the Vercel API", vars: ["VERCEL_API_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_TEAM_ID"], optional: true },
];

const PLACEHOLDERS = /^(change-me|price_\.\.\.|whsec_\.\.\.|sk_test_\.\.\.|pk_test_\.\.\.|re_\.\.\.|ca_\.\.\.|vercel_blob_rw_\.\.\.|you@example\.com|change-me-too)$/;

let missingTotal = 0;
for (const group of GROUPS) {
  const missing = group.vars.filter((v) => {
    const val = process.env[v]?.trim();
    return !val || PLACEHOLDERS.test(val);
  });
  const status = missing.length === 0 ? "ok" : group.optional ? "optional, not set" : `${missing.length} missing`;
  console.log(`${group.name}: ${status}`);
  for (const v of missing) console.log(`  - ${v}`);
  if (!group.optional) missingTotal += missing.length;
}
if (process.env.APP_SECRET && process.env.APP_SECRET.length < 32 && !PLACEHOLDERS.test(process.env.APP_SECRET)) {
  console.log("APP_SECRET is shorter than 32 characters; generate one with: openssl rand -base64 48");
}
console.log(missingTotal === 0 ? "\nAll required variables are set." : `\n${missingTotal} required variable(s) missing. See .env.example for what each one is.`);
