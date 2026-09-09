# Production setup

A runbook, followed top to bottom once. Each section is filled in as its phase is built; sections marked "to write" are not done yet. Never paste secret values into this file.

## 1. Vercel project (to write in full)

- Create a new Vercel project from this repository with **Root Directory** set to `saas`.
- Plan: **Pro**. Vercel's Hobby terms do not allow commercial use.
- Domains: the root domain (`APP_DOMAIN`), the wildcard `*.APP_DOMAIN` for studio subdomains, and later each studio's custom domain.
- Environment variables: every key in `.env.example`, in Production and Preview. Run `npm run env:check` locally with the same values to confirm nothing is missing.
- Cron jobs come from `vercel.json` (daily at 06:00 UTC, frequent every 15 minutes). Set `CRON_SECRET`; Vercel sends it as `Authorization: Bearer ...`.

## 2. Neon Postgres (to write in full)

- Create a project; use the pooled connection string as `DATABASE_URL`.
- The schema is applied on every build by `scripts/db-migrate.mjs`. To apply by hand: `DATABASE_URL=... npm run db:migrate`.
- Point-in-time restore is available on Neon; the restore drill is plan item 22.14.

## 3. Vercel Blob (to write in full)

- Two stores: `galleries` (private; photos and documents) and `assets` (public; site images and logos).
- Tokens: `BLOB_READ_WRITE_TOKEN` and `ASSETS_READ_WRITE_TOKEN`.

## 4. Stripe

### 4a. Platform billing (the $40/month subscription)

- Run `STRIPE_SECRET_KEY=sk_... NEXT_PUBLIC_APP_URL=https://... npm run stripe:setup`. It creates the product and price (`STRIPE_PRICE_STUDIO_MONTHLY`), the referral coupon (`STRIPE_REFERRAL_COUPON_ID`) and, when the URL is public https, both webhook endpoints, printing the env lines once.
- Customer Portal (Dashboard → Settings → Billing → Customer portal): allow updating payment methods and cancelling; leave plan switching off.

### 4b. Client payments (each studio's own Stripe account)

Follow Appendix A in `docs/BUILD-PLAN.md`: platform profile, Connect branding, OAuth client id and redirect URI (`STRIPE_CONNECT_CLIENT_ID`), the connected-accounts webhook (`STRIPE_CONNECT_WEBHOOK_SECRET`). We create direct charges on the studio's account with no application fee; refunds and disputes are the studio's, in their own Dashboard.

### 4c. Testing webhooks locally

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe listen --forward-connect-to localhost:3000/api/stripe/connect-webhook
stripe trigger checkout.session.completed
stripe trigger --stripe-account acct_xxx checkout.session.completed
```

`stripe listen` prints a signing secret; put it in `.env.local` as the matching `STRIPE_*_WEBHOOK_SECRET` while testing.

## 5. Resend (to write in full)

- Verify the platform sending domain (a subdomain such as `mail.APP_DOMAIN`) and set `RESEND_API_KEY`, `EMAIL_FROM`.
- Webhook endpoint `https://APP_DOMAIN/api/resend/webhook` for email events and `domain.updated`; set `RESEND_WEBHOOK_SECRET`.
- Plan size: each studio that verifies its own sending domain uses one Resend domain. Pro allows 10, Scale 1,000, and an add-on adds 100 for $20/month (checked September 9, 2026).

## 6. DNS (to write in full)

- `APP_DOMAIN` and `*.APP_DOMAIN` to Vercel.
- `mail.APP_DOMAIN` records from Resend.
- Studios add a CNAME for their custom domains (instructions are shown in their settings page).

## 7. First admin

- Sign up in the app, then `DATABASE_URL=... npm run platform:admin you@example.com`.

## 8. Going live checklist

See `docs/LAUNCH-CHECKLIST.md` (plan item 22.20).
