# Launch checklist

Work top to bottom. Do everything in a Stripe **sandbox** and a Resend test
domain first, then repeat in live mode. Items marked (ops) happen in a dashboard
or DNS, not in this repo. See `docs/SETUP.md` for the full env-var reference and
`docs/BUILD-PLAN.md` Appendix A for the Stripe Connect platform steps.

## 22.20.1 Legal pages reviewed
- [ ] Terms, Privacy and any cookie notice read end to end at `/terms`, `/privacy`.
- [ ] Studio agreement default template reviewed (`/studio/settings/agreement`).
- [ ] Contact/support email and business identity correct in the footer.

## 22.20.2 Stripe live keys and price (ops)
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` set to **live** values on the Vercel project.
- [ ] The $40/month platform price created in live mode; `STRIPE_PRICE_ID` points to it (`npm run stripe:setup` or the dashboard).

## 22.20.3 Connect platform profile complete in live mode (ops)
- [ ] Platform profile at Settings → Connect completed for **direct charges, no application fee, connected accounts have full dashboard access** (Appendix A).
- [ ] Connect branding (name, color, icon) set.
- [ ] OAuth enabled; `STRIPE_CONNECT_CLIENT_ID` is the **live** `ca_…`; redirect URI `https://APP_DOMAIN/api/connect/oauth/callback` added.

## 22.20.4 Webhooks live and tested (ops)
- [ ] Platform webhook → `https://APP_DOMAIN/api/stripe/webhook` for the subscription and Connect events; signing secret in `STRIPE_WEBHOOK_SECRET`.
- [ ] Connect (connected-account) events delivered and handled: `checkout.session.completed`, `charge.refunded`, `charge.dispute.created`.
- [ ] Resend webhook → `/api/resend/webhook`; Svix signing secret set; a test event mirrors into the email log.

## 22.20.5 Resend production domain verified (ops)
- [ ] Platform sending domain verified in Resend; `RESEND_API_KEY` and `EMAIL_FROM` set.
- [ ] A studio can add and verify its own sending domain end to end (`/studio/settings/email-domain`).

## 22.20.6 DNS and wildcard (ops)
- [ ] Apex + `www` for the marketing site.
- [ ] Wildcard `*.APP_DOMAIN` → the app, so `slug.APP_DOMAIN` studio sites resolve.
- [ ] Custom-domain flow verified: a studio adds a domain, the DNS records check green, and `/t/[slug]` serves it.

## 22.20.7 Backups verified (ops)
- [ ] Neon point-in-time restore exercised once on a branch.
- [ ] Blob export/inventory script run and stored.

## 22.20.8 Monitoring and alert email (ops)
- [ ] Log drain / error alerting wired for `level:"error"` lines.
- [ ] Cron endpoints (`/api/cron/frequent`, `/api/cron/daily`) scheduled and authenticated (`CRON_SECRET`).
- [ ] Platform daily digest arrives at the alert address.

## 22.20.9 Support email and hours
- [ ] `SUPPORT_EMAIL` set and monitored; response window stated on the site.

## 22.20.10 Status page link
- [ ] Status page URL linked in the footer / help.

## Final gates
- [ ] `npm run check` green locally; CI green on the release commit (typecheck, lint, tests+coverage, build).
- [ ] 22.23 Owner test studio on production: full run (create client → gallery → upload → publish → open as client → favorite → pay a real $1 in the owner's own Stripe → refund it).
- [ ] 22.21 Real marketing screenshots in place of placeholders.
- [ ] 22.24 Name chosen and the rename pass (plan 1.30) executed; `pr_`/Proofroom placeholders replaced.
- [ ] 22.25 Tag `v1.0` and add the release entry to `CHANGELOG.md`.
