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

## 5. Resend

Email is sent through Resend. Studio mail can leave from the platform's shared
address (with the studio's name) or, once a studio verifies its own domain, from
that domain.

1. **Account and API key.** Create a Resend account and an API key with send
   access. Set `RESEND_API_KEY`.
2. **Platform sending domain.** In Resend, add a subdomain you control for the
   platform itself, e.g. `mail.APP_DOMAIN`. Create the DKIM/SPF records Resend
   shows at your DNS host and wait for it to verify. Set `EMAIL_FROM` to an
   address on that domain, e.g. `hello@mail.APP_DOMAIN`. This is the fallback
   sender for every studio that has not verified its own domain, and the sender
   for platform mail (login, billing).
3. **Webhook.** In Resend, add a webhook to `https://APP_DOMAIN/api/resend/webhook`
   subscribed to `email.delivered`, `email.opened`, `email.clicked`,
   `email.bounced`, `email.complained` and `domain.updated`. Copy its signing
   secret (starts with `whsec_`) into `RESEND_WEBHOOK_SECRET`. The endpoint
   verifies the Svix signature on every request and refuses unsigned requests in
   production; delivery events update the email log, hard bounces and complaints
   add suppressions, and `domain.updated` mirrors a studio's sending-domain
   status.
4. **Per-studio sending domains.** Studios add their own domain under
   Settings → Email domain. The app calls Resend to create the domain, shows the
   DNS records, and verifies on demand and on the cron. Each verified studio
   domain is one Resend domain against your plan.
5. **Plan size.** Pro allows 10 domains, Scale 1,000, and an add-on adds 100 for
   $20/month (checked September 9, 2026). The platform admin surfaces domains
   used against the limit with a warning at 80%. Pick a plan for the number of
   studios you expect to verify their own domain.

Local testing: without `RESEND_API_KEY` the app logs each email as `skipped`
rather than sending, so the rest of the flow still works. To exercise the
webhook locally, forward Resend events (or replay a saved payload) to
`localhost:3000/api/resend/webhook` with valid `svix-*` headers; an unsigned
request is accepted only outside production.

## 6. DNS (to write in full)

- `APP_DOMAIN` and `*.APP_DOMAIN` to Vercel.
- `mail.APP_DOMAIN` records from Resend.
- Studios add a CNAME for their custom domains (instructions are shown in their settings page).

## 7. First admin

- Sign up in the app, then `DATABASE_URL=... npm run platform:admin you@example.com`.

## 8. Going live checklist

See `docs/LAUNCH-CHECKLIST.md` (plan item 22.20).
