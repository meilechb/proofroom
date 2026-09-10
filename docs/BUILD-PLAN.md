# Build plan (revision 4, September 9, 2026)

A multi-tenant platform for photographers. Each studio gets: a public website built from one of two templates, branded client galleries with proofing, deposits and e-signed agreements paid into the studio's **own** Stripe account, a CRM (inbox, clients, sessions, tasks), an asset library, email templates and automations sent from the studio's **own** domain, unlimited team seats, a referral program, a booking page, import from other gallery tools, session planning, and a two-way Lightroom Classic plugin. Built as a separate app in `saas/`, deployed to its own Vercel project and domain.

**One plan. $40 per month. Everything included. Unlimited seats. 14-day free trial.** No feature is gated behind a tier. Pricing is revisited after launch with real customers; nothing in the code assumes tiers beyond a single `plan` string so that tiers can be added later without a rewrite.

**Name: on hold.** Code uses the placeholder `NEXT_PUBLIC_APP_NAME` (currently "Proofroom") and neutral identifiers (`app`, `pr_`) that a single rename pass (item 1.30) replaces. Candidate names checked on September 9 are kept in `docs/NAME-CANDIDATES.md` for later.

Legend: `[ ]` not started, `[x]` done, `[~]` partly done, `[-]` removed by decision. Every item is one small, verifiable piece: a file, a function, a column, a page state, a test, or a doc section. Items are numbered `phase.item` and built in order unless a dependency is noted.

**Status: approved to build. Work proceeds one item at a time, in order, each item committed and pushed on its own, with typecheck, lint and tests green before every push.**

---

## What changed in revision 4 (from feedback on September 9)

1. One plan at $40 per month, unlimited seats, all features. No Free tier, no Starter/Pro/Studio, no yearly price yet, no entitlement gating. The `plans.ts` catalog becomes a single entry; `entitlements()` returns only trial state and payment state.
2. Name decision deferred. Rename pass planned as one item.
3. Referral reward is **10% off for the next 12 months** for both the referrer and the referred studio, granted when the referred studio's first paid invoice succeeds.
4. Stripe Connect platform registration confirmed. The step-by-step walkthrough for the Stripe Dashboard is Appendix A.
5. Import, booking page and session planning (previously proposed) are in scope as Phase 21.
6. Plan expanded to ~1,100 pieces so every step is small and checkable.

---

## Phase 0. Decisions (all made)

- [x] 0.1 App lives in `saas/`, own `package.json`, own Vercel project with Root Directory `saas`.
- [x] 0.2 Next.js 16.3.4 App Router, React 19, TypeScript strict, Tailwind 4, Cache Components off. Docs in `node_modules/next/dist/docs/` are read before touching any Next API.
- [x] 0.3 Neon Postgres via serverless HTTP driver, plain SQL with bound parameters, idempotent `db/schema.sql` applied on every build.
- [x] 0.4 Tenant is `studios`; every domain table carries `studio_id`; users join via `memberships` with roles owner, admin, member.
- [x] 0.5 Tenant hosts: `{slug}.APP_DOMAIN` and verified custom domains rewrite to `/t/{slug}/...`; the path form also works on the root host and on Vercel previews.
- [x] 0.6 Auth: scrypt passwords, database sessions in an httpOnly cookie, hashed one-time tokens, Postgres rate limits, lockout after repeated failures. No 2FA, no SSO.
- [ ] 0.7 Platform billing: Stripe subscription, one price ($40/month, lookup key `studio_monthly`), 14-day trial without card, Stripe Checkout to subscribe, Stripe Customer Portal to manage card and cancel. After the trial ends unpaid: studio app becomes read-only, published galleries and the website stay live for 30 days, then galleries lock with a "contact the studio" message. Data is kept 90 days after cancellation, then deleted.
- [ ] 0.8 Client payments: the studio's own Stripe account, connected as a Standard-equivalent account, direct charges, no application fee, no platform liability. Stripe's docs (read September 9): the Standard column lists "Fraud and dispute liability: Connected account for direct charges", Stripe handles onboarding and identity, the account has the full Stripe Dashboard, and "There's an additional cost for using Express or Custom connected accounts" (none for Standard). Controller defaults for such an account: `losses.payments = stripe`, `fees.payer = account`, `requirement_collection = stripe`, `stripe_dashboard.type = full`. "The payment appears as a charge on the connected account, not your platform's account." We never send `application_fee_amount`. Refunds and disputes are handled by the studio in its own Dashboard; we only mirror status from webhooks. Two connection methods: OAuth for an existing Stripe account, Account Links for a new one. Fallback setting for studios that refuse to connect: paste a Stripe Payment Link or bank instructions and mark orders paid by hand.
- [x] 0.9 Storage: Vercel Blob, private store for photos and documents, public store for site images and logos. Usage metered per studio and shown, not capped. Platform admin sees studios above 500 GB. Terms carry a fair-use clause.
- [ ] 0.10 Email: Resend. Default sender is the platform domain with the studio's name as display name and the studio's reply-to. Any studio can verify its own sending subdomain (Resend recommends a subdomain such as `mail.studio.com` "to isolate your sending reputation"); once verified, all client-facing mail leaves from it. Platform mail (login, billing) always uses our domain. Resend plan limits checked September 9: Pro 10 domains, Scale 1,000, add-on $20/month per 100 domains.
- [x] 0.11 Lightroom Classic plugin generalized: token per studio, publish, republish, delete, favorites and comments back into Lightroom.
- [x] 0.12 Vercel Pro is required for commercial use (Hobby terms forbid it). Documented in SETUP.
- [ ] 0.13 Tenant website: two templates ("Editorial" light, "Gallery" dark), fixed pages and sections, per-section text, image, on/off; site-wide colors, base, font pairing, logo, favicon. No block editor, no custom HTML.
- [x] 0.14 Asset library: one `assets` table for every uploaded image, referenced by id, with usage counts.
- [ ] 0.15 Name deferred; rename pass is item 1.30.
- [ ] 0.16 Referral: 10% off for 12 months for both parties, triggered by the referred studio's first paid invoice. Stripe coupon `percent_off=10, duration=repeating, duration_in_months=12`. If the recipient already has an active discount, the reward is queued and applied when the current one ends.
- [x] 0.17 Removed: two-factor auth, SSO, outbound webhooks, blog posts, print lab, platform fee on client payments. Deferred: native mobile apps.
- [ ] 0.18 In scope (Phase 21): import from Pixieset, Pic-Time, ShootProof exports and plain zips; booking page with availability; session planning (notes, shot list, mood board).

---

## Phase 1. Scaffold, tooling, configuration

- [x] 1.1 `saas/package.json` with scripts dev, build, start, lint, typecheck, test, db:migrate, stripe:setup, plugin:zip, platform:admin.
- [x] 1.2 `tsconfig.json` strict, path alias `@/*`.
- [x] 1.3 `eslint.config.mjs` (eslint-config-next).
- [x] 1.4 `postcss.config.mjs` for Tailwind 4.
- [x] 1.5 `vitest.config.ts`.
- [x] 1.6 `next.config.ts`: image remote patterns for Blob, Server Actions `allowedOrigins` for `APP_DOMAIN` and `*.APP_DOMAIN`, body size limit 2 MB.
- [x] 1.7 `next.config.ts`: security headers (HSTS, nosniff, frame DENY, referrer policy, permissions policy).
- [x] 1.8 `.env.example` with every variable and a one-line comment each.
- [x] 1.9 `.env.example`: remove `PLATFORM_FEE_BPS`, `STRIPE_PRICE_STARTER_*`, `STRIPE_PRICE_PRO_*`, `STRIPE_PRICE_STUDIO_YEARLY`.
- [x] 1.10 `.env.example`: add `STRIPE_PRICE_STUDIO_MONTHLY`, `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_REFERRAL_COUPON_ID`, `RESEND_WEBHOOK_SECRET`, `CRON_SECRET`, `PLATFORM_ALERT_EMAIL`.
- [x] 1.11 `.gitignore` for `saas/` (node_modules, .next, .env*, coverage).
- [x] 1.12 `scripts/db-migrate.mjs`: applies `db/schema.sql`, `--if-configured` skips when `DATABASE_URL` is absent.
- [x] 1.13 `scripts/stripe-setup.mjs`: creates products and prices by lookup key, idempotent.
- [x] 1.14 `scripts/stripe-setup.mjs`: reduce to one product "Studio" and one price $40/month with lookup key `studio_monthly`; print the price id to paste into env.
- [x] 1.15 `scripts/stripe-setup.mjs`: create coupon `referral_10_12mo` (10% off, repeating, 12 months) if missing; print its id.
- [x] 1.16 `scripts/stripe-setup.mjs`: create the two webhook endpoints by API when `APP_URL` is set (account events → `/api/stripe/webhook`; connected-account events with `connect=true` → `/api/stripe/connect-webhook`) and print the signing secrets once.
- [x] 1.17 `scripts/make-platform-admin.mjs <email>`.
- [x] 1.18 `scripts/plugin-zip.mjs` stamps `__SITE_URL__` into the plugin config and zips it.
- [ ] 1.19 `scripts/seed-demo.mjs`: creates a demo studio with clients, sessions, galleries (placeholder images), for local testing; refuses to run against a production URL.
- [x] 1.20 `scripts/check-env.mjs`: lists required env vars and which are missing; used by `npm run dev` preflight.
- [x] 1.21 `.github/workflows/saas.yml`: on push and PR touching `saas/**`, run install, typecheck, lint, test, build with no secrets.
- [x] 1.22 `.github/workflows/saas.yml`: cache npm; Node 22.
- [x] 1.23 `saas/vercel.json`: cron `0 6 * * *` hitting `/api/cron/daily`, and `*/15 * * * *` hitting `/api/cron/frequent`.
- [x] 1.24 `saas/README.md`: what this app is, how to run locally, where the docs are.
- [~] 1.25 `docs/SETUP.md` skeleton: Vercel, Neon, Blob, Stripe, Resend, DNS, first admin.
  - [ ] 1.25.1 Vercel project (Root Directory saas, Pro plan, wildcard domain, env vars)
  - [ ] 1.25.2 Neon project, branch, connection string, migrate on build
  - [ ] 1.25.3 Vercel Blob: private and public stores, tokens
  - [ ] 1.25.4 Stripe: keys, product and price, portal, webhooks (from Appendix A)
  - [ ] 1.25.5 Resend: API key, platform domain records, webhook
  - [ ] 1.25.6 DNS: root, wildcard, app subdomain, mail subdomain
  - [ ] 1.25.7 First platform admin via script; first test studio
- [~] 1.26 `docs/ARCHITECTURE.md` skeleton: tenancy, auth, storage, payments, email, plugin.
  - [ ] 1.26.1 Tenancy and host routing
  - [ ] 1.26.2 Auth and sessions
  - [ ] 1.26.3 Storage and image pipeline
  - [ ] 1.26.4 Payments: subscription vs studio Stripe connection
  - [ ] 1.26.5 Email and sending domains
  - [ ] 1.26.6 Lightroom API and plugin
- [x] 1.27 `docs/NAME-CANDIDATES.md`: the September 9 availability list, for the naming decision later.
- [ ] 1.28 Root repo `tsconfig.json` and `eslint.config.mjs` exclude `saas/` (done in commit 64f6053); confirm root `npm run build` still passes after every saas change touching root files.
- [x] 1.29 `saas/.nvmrc` with Node 22.
- [ ] 1.30 Rename pass (when the name is chosen): env default, cookie name `pr_session`, token prefix `pr_live_`, plugin folder and id, email footer, docs. One commit.
- [x] 1.31 `saas/src/instrumentation.ts`: request id per request in logs.
- [x] 1.32 Error reporting hook: `logger.error` writes structured JSON; SETUP notes how to ship to Vercel logs drain later.
- [x] 1.33 `saas/CHANGELOG.md` started; every phase appends a line.

## Phase 2. Database schema (`saas/db/schema.sql`)

Identity and tenancy
- [x] 2.1 `users` (id, email unique lower, name, password_hash, email_verified_at, is_platform_admin, created_at, updated_at, last_login_at, failed_logins, locked_until).
- [x] 2.2 `studios` core columns (id, slug unique, name, legal_name, email, phone, location, timezone, currency, branding jsonb, onboarding jsonb, settings jsonb, created_at, updated_at, suspended_at, deleted_at).
- [x] 2.3 `studios` billing columns (plan, trial_ends_at, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end, cancel_at_period_end).
- [x] 2.4 `studios`: drop `billing_interval`; `plan` defaults to `studio`; add `read_only_since`, `grace_ends_at`.
- [x] 2.5 `studios` Stripe connection columns (stripe_account_id, stripe_account_status).
- [x] 2.6 `studios`: add `stripe_connect_method` (`oauth` | `onboarding` | `manual` | `none`), `stripe_charges_enabled` bool, `stripe_details_submitted` bool, `stripe_connected_at`, `manual_payment_instructions` text, `manual_payment_link` text.
- [x] 2.7 `studios` domain columns (custom_domain unique, custom_domain_verified_at).
- [x] 2.8 `studios`: add `referral_code` unique, `referred_by_code`, `site` jsonb, `site_draft` jsonb, `site_published_at`, `site_template` text.
- [x] 2.9 `memberships` (studio_id, user_id, role, created_at) unique pair.
- [x] 2.10 `invitations` (studio_id, email, role, token_hash, expires_at, accepted_at, invited_by).
- [x] 2.11 `sessions` (id, user_id, studio_id, token_hash unique, expires_at, created_at, last_seen_at, user_agent, ip).
- [x] 2.12 `auth_tokens` (user_id, purpose, token_hash, expires_at, consumed_at).
- [x] 2.13 `rate_limits` (key, window_start, count).
  - [ ] 2.13.1 Three default packages
  - [ ] 2.13.2 Site defaults for the chosen template
  - [ ] 2.13.3 Default email templates (copied lazily on first edit)
  - [ ] 2.13.4 Default agreement template v1
  - [ ] 2.13.5 Referral code
- [x] 2.14 `audit_log` (studio_id, user_id, action, target_type, target_id, meta jsonb, created_at).
- [x] 2.15 `api_tokens` (studio_id, name, token_hash unique, last_used_at, revoked_at, created_by).
- [x] 2.16 `stripe_events` (id primary, type, processed_at) for idempotency.
- [x] 2.17 `platform_settings` (key, value jsonb) for toggles such as signups_open, maintenance_banner.

CRM
- [x] 2.18 `clients` (studio_id, name, email, phone, company, stage, notes, tags text[], unsubscribed_at, source, created_at, updated_at).
- [x] 2.19 `clients`: unique (studio_id, lower(email)) where email not null; add `last_activity_at`, `archived_at`.
- [x] 2.20 `inquiries` (studio_id, name, email, phone, message, source, read_at, archived_at, client_id, created_at).
- [x] 2.21 `booking_requests` (studio_id, client_id, package_id, requested_at, preferred_times, status, notes).
- [x] 2.22 `tasks` (studio_id, client_id, order_id, title, due_at, done_at, assigned_user_id, created_by).
- [x] 2.23 `client_notes` (studio_id, client_id, author_user_id, body, kind, created_at).
- [x] 2.24 `client_events` (studio_id, client_id, kind, ref_type, ref_id, created_at) for the timeline (gallery sent, payment received, email sent).
- [x] 2.25 `leads` (platform-level contact form).

Sales
- [x] 2.26 `packages` (studio_id, name, description, price_cents, deposit_cents, included_finals, extra_final_cents, duration_minutes, is_active, show_on_site, sort_order).
- [x] 2.27 `orders` (studio_id, order_number, client_id, package_id, title, scheduled_at, status, total_cents, deposit_cents, discount_cents, notes, contract_version, contract_signed_at, contract_signer_name, contract_ip, created_at) unique (studio_id, order_number).
- [x] 2.28 `payments` (studio_id, order_id, amount_cents, method, status, stripe_account_id, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, refunded_cents, paid_at, created_at).
- [x] 2.29 `payments`: drop `platform_fee_cents`; add `dispute_status`, `disputed_at`, `receipt_url`.
- [x] 2.30 `documents` (studio_id, client_id, order_id, kind, title, blob_path, size_bytes, created_at).
- [x] 2.31 `agreement_templates` (studio_id, version, body_md, created_at, is_active) replacing the single hard-coded contract.

Galleries
- [x] 2.32 `galleries` (studio_id, client_id, order_id, parent_id, subject_name, slug unique per studio, title, kind, status, access_code_hash, password_hash, welcome, allow_downloads, allow_comments, expires_at, published_at, watermark, download_pin_hash, view_count, created_at).
- [x] 2.33 `galleries`: add `download_size` (`web` | `full` | `both`), `pay_gated` bool, `allow_client_upload` bool, `allow_sharing` bool, `cover_photo_id`, `sort_mode`.
- [x] 2.34 `photos` (gallery_id, studio_id, filename, blob_path, preview_path, thumb_path, width, height, size_bytes, sort_order, lr_id, created_at).
- [x] 2.35 `photos`: add `sha256`, `uploaded_by` (`studio` | `client` | `plugin`), `deleted_at` for soft delete with 30-day purge.
- [x] 2.36 `photo_comments` (photo_id, gallery_id, author_role, author_name, body, resolved_at, created_at).
- [x] 2.37 `photo_selections` (photo_id, gallery_id, kind, created_at) unique (photo_id, kind).
- [x] 2.38 `gallery_visits` (gallery_id, visitor_hash, first_seen, last_seen, views, downloads) for per-gallery analytics.
- [x] 2.39 `gallery_downloads` (gallery_id, photo_id nullable, kind, visitor_hash, created_at).

Website, portfolio, assets
- [x] 2.40 `assets` (studio_id, kind, filename, blob_path, variants jsonb, width, height, size_bytes, alt, tags text[], created_at).
- [x] 2.41 `assets`: add `usage_count` int maintained by triggers or app code; `deleted_at`.
- [x] 2.42 `portfolio_items` (studio_id, asset_id, category, caption, featured, sort_order, published).
- [x] 2.43 `reviews` (studio_id, author, role, body, rating, published, sort_order).
- [x] 2.44 Drop `site_pages`; the site lives in `studios.site` / `site_draft` (see 2.8).
- [x] 2.45 `site_areas` (studio_id, town, slug, intro_override, published) for local landing pages.
- [x] 2.46 `analytics_daily` (studio_id, day, kind, key, count) unique quadruple.

Email
- [x] 2.47 `email_templates` (studio_id, key, subject, body, updated_at) unique (studio_id, key).
- [x] 2.48 `email_log` (studio_id, to_email, template_key, subject, provider_id, status, error, related_type, related_id, created_at).
- [x] 2.49 `email_log`: add `opened_at`, `clicked_at`, `bounced_at`, `complained_at`, `from_domain`.
- [x] 2.50 `automation_sends` (studio_id, rule, target_type, target_id, sent_at) unique triple.
- [x] 2.51 `sending_domains` (studio_id unique, domain, resend_domain_id, status, records jsonb, from_local_part, region, verified_at, last_checked_at, created_at).
- [x] 2.52 `suppressions` (studio_id, email, reason, created_at) unique (studio_id, email).
- [x] 2.53 `broadcasts` (studio_id, subject, body, filter jsonb, status, scheduled_at, sent_at, recipient_count, created_by).

Referrals, imports, booking, planning
- [x] 2.54 `referrals` (referrer_studio_id, code, referred_studio_id, status, signed_up_at, rewarded_at, invoice_id, referrer_reward_state, referred_reward_state, void_reason).
- [x] 2.55 `reward_queue` (studio_id, coupon_id, reason, ref_id, apply_after, applied_at).
- [x] 2.56 `imports` (studio_id, source, status, file_count, gallery_count, photo_count, log jsonb, started_at, finished_at, created_by).
- [x] 2.57 `import_files` (import_id, blob_path, size_bytes, status, error).
- [ ] 2.58 `booking_settings` in `studios.settings.booking` (weekly hours, buffer, lead time, max per day, enabled).
- [x] 2.59 `booking_slots` (studio_id, starts_at, ends_at, package_id, client_id, order_id, status) with exclusion constraint on overlapping confirmed slots.
- [x] 2.60 `session_plans` (order_id unique, notes_md, shot_list jsonb, mood_asset_ids uuid[], client_visible bool, updated_at).

Indexes and constraints
- [x] 2.61 Indexes on every `studio_id` and every foreign key used in lists.
  - [x] 2.61.1 clients (studio_id, stage), (studio_id, lower(email))
  - [x] 2.61.2 inquiries (studio_id, read_at)
  - [x] 2.61.3 orders (studio_id, status), (client_id)
  - [x] 2.61.4 payments (order_id), (stripe_checkout_session_id unique)
  - [x] 2.61.5 galleries (studio_id, status), (client_id), (parent_id), (studio_id, slug unique)
  - [x] 2.61.6 photos (gallery_id, sort_order), (sha256)
  - [x] 2.61.7 photo_comments (gallery_id, resolved_at)
  - [x] 2.61.8 photo_selections (gallery_id, kind)
  - [x] 2.61.9 assets (studio_id, kind), tags gin
  - [x] 2.61.10 email_log (studio_id, created_at)
  - [x] 2.61.11 audit_log (studio_id, created_at)
  - [x] 2.61.12 sessions (user_id), (expires_at) for cleanup
- [x] 2.62 Partial index `galleries (studio_id) where status='published'`.
- [x] 2.63 Index `orders (studio_id, scheduled_at)`, `payments (studio_id, paid_at)`, `email_log (studio_id, created_at desc)`, `client_events (client_id, created_at desc)`.
- [x] 2.64 Unique `referrals.code`; unique `studios.referral_code`.
- [x] 2.65 `updated_at` trigger function applied to tables with the column.
- [ ] 2.66 Cascade rules reviewed: deleting a studio soft-deletes; hard purge job removes rows and blobs 90 days later.
- [x] 2.67 Schema smoke test: `db-migrate` twice in a row produces no errors (idempotency).
- [x] 2.68 `docs/ARCHITECTURE.md` gets the table list with one line each.

## Phase 3. Core libraries (`saas/src/lib`)

Environment, database, logging
- [x] 3.1 `env.ts`: typed getters, `isConfigured.stripe/blob/resend/db` flags, `appUrl()`, `appDomain()`.
- [x] 3.2 `env.ts`: add getters for the new variables in 1.10; remove plan price getters.
- [x] 3.3 `db.ts`: neon `sql` tag, `one()`, `many()`, `maybe()` helpers.
- [x] 3.4 `db.ts`: `withTx()` using neon transactions for multi-statement writes (order + payment, import batches).
- [x] 3.5 `logger.ts`: structured JSON, levels, redaction of emails and tokens.
- [x] 3.6 `action-state.ts`: `ok()`, `fail()`, `fieldErrors()` shape for Server Actions.

Auth and sessions
- [x] 3.7 `password.ts`: scrypt hash, verify, strength rules (12+ chars, not in a small deny-list).
- [x] 3.8 `tokens.ts`: random tokens, sha256 hashing, `generateApiToken()` with prefix.
- [x] 3.9 `session.ts`: create, read (rolling), set active studio, delete, revoke all.
- [x] 3.10 `auth.ts`: `getCurrentUser`, `listMemberships`, `getStudioContext`, `requireStudioPage`, `requireStudio`, `requireUser`, `requirePlatformAdminPage`, `requirePlatformAdmin`, `assertOwned`, `hasRole`.
- [x] 3.11 `auth.ts`: `requireWritableStudio()` that also rejects when the studio is read-only (trial expired) or suspended, returning a typed reason for the UI.
- [x] 3.12 `rate-limit.ts`: fixed window in Postgres, keyed by purpose + ip or email.
- [x] 3.13 `rate-limit.ts`: presets (`login`, `signup`, `gallery_unlock`, `contact_form`, `api_token`, `password_reset`) with documented limits.
- [x] 3.14 `audit.ts`: `audit(studioId, userId, action, target, meta)`.
- [x] 3.15 `slug.ts`: `RESERVED_SLUGS`, `studioSlugProblem()`, `slugify()`.
- [x] 3.16 `account.ts`: create user with studio, create studio for user, seed defaults, check credentials with lockout, issue and consume tokens, mark verified, set password, slug available, find by email.
- [x] 3.17 `account.ts`: on studio creation also generate `referral_code`, seed agreement template v1, seed site defaults.

Tenancy and URLs
- [x] 3.18 `tenant.ts`: `classifyHost()`, `studioBaseUrl()`, `galleryUrl()`, `payUrl()`, `tenantPath()`.
- [x] 3.19 `tenant.ts`: `bookingUrl()`, `clientHubUrl()`, `areaUrl()`.
- [x] 3.20 `tenant.ts` tests: root host, subdomain, custom domain, preview host, port suffix, uppercase host.

Billing (platform subscription)
- [x] 3.21 `plans.ts`: catalog and `entitlements()`.
- [x] 3.22 `plans.ts`: single plan `{ id: "studio", name: "Studio", monthlyCents: 4000, lookupKey: "studio_monthly" }`; `TRIAL_DAYS = 14`.
- [x] 3.23 `plans.ts`: `billingState(studio)` returns `trialing | active | past_due | read_only | cancelled` with days left and grace end.
- [x] 3.24 `plans.ts`: remove limits and feature flags; keep `formatBytes`.
- [x] 3.25 `plans.ts` tests for each state transition and boundary (trial ends today, grace ends today).
- [x] 3.26 `stripe.ts`: `stripe()` client, `onAccount()` request options, `priceId()`.
- [x] 3.27 `stripe.ts`: remove fee helpers and multi-price mapping; add `referralCouponId()`.
- [x] 3.28 `billing.ts`: `ensureCustomer(studio)`, `createSubscriptionCheckout(studio, returnUrl, coupon?)`, `createPortalSession(studio)`, `applySubscriptionEvent(event)`.
  - [x] 3.28.1 ensureCustomer(studio) creates or reuses the Stripe customer with studio metadata
  - [x] 3.28.2 createSubscriptionCheckout(studio, returnUrl, coupon?) with trial carry-over
  - [x] 3.28.3 createPortalSession(studio)
  - [x] 3.28.4 applySubscriptionEvent(event) mapping status, period end, cancel flag
- [x] 3.29 `billing.ts`: `setReadOnlyIfExpired(studio)` used by cron and by `requireWritableStudio`.

Client payments (studio's Stripe account)
- [x] 3.30 `connect.ts`: `oauthAuthorizeUrl(studio, state)` with `client_id`, `scope=read_write`, `redirect_uri`, `stripe_user[email|business_name|url|country]`.
- [x] 3.31 `connect.ts`: `exchangeOauthCode(code)` → `stripe_user_id`; `deauthorize(accountId)`.
- [x] 3.32 `connect.ts`: `createStandardAccount(studio)` (no `type`, no controller overrides) and `createOnboardingLink(accountId, returnUrl, refreshUrl)`.
- [x] 3.33 `connect.ts`: `refreshAccountStatus(studio)` reads `charges_enabled`, `details_submitted`, `requirements.currently_due`.
- [x] 3.34 `connect.ts`: signed `state` (HMAC with `APP_SECRET`, studio id, expiry) for OAuth CSRF protection.
- [x] 3.35 `payments.ts`: `createOrderCheckout(order, kind: deposit|balance|full)` → Checkout Session on the studio's account, no application fee, metadata `order_id`, success and cancel URLs on the tenant host.
  - [x] 3.35.1 Deposit session: amount = deposit due, description 'Deposit for order #N'
  - [x] 3.35.2 Balance session: amount = remaining balance
  - [x] 3.35.3 Full session: amount = total when nothing paid
  - [x] 3.35.4 Metadata: order_id, studio_id, kind; client_reference_id = order id
- [x] 3.36 `payments.ts`: `recordCheckoutCompleted(event)` idempotent by session id; `recordRefund(event)`; `recordDispute(event)`.
- [x] 3.37 `payments.ts`: `orderMoney(order, payments)` (total, paid, refunded, balance, deposit due) with tests for partial payments and refunds.
- [x] 3.38 `payments.ts`: `manualPayment(order, amount, method, note)` and `undoManualPayment()`.
- [~] 3.39 `payments.ts` tests with fixture events (completed, async succeeded, async failed, refunded, disputed, deauthorized).

Storage and images
- [x] 3.40 `storage.ts`: two Blob stores, per-studio key prefixes, `put`, `del`, `signedGet`.
- [x] 3.41 `storage.ts`: `clientUploadToken(studio, gallery, filename, size)` for browser direct uploads with size and type limits.
- [x] 3.42 `storage.ts`: `deleteMany()` batching and retry.
- [x] 3.43 `images.ts`: sharp preview (1600), thumb (480), logo resize.
- [x] 3.44 `images.ts`: text watermark overlay (studio name, diagonal, 30% opacity) applied to previews when the gallery has watermark on.
- [x] 3.45 `images.ts`: EXIF orientation fix, strip metadata on previews, keep on originals.
- [x] 3.46 `images.ts`: `sha256(buffer)` for duplicate detection.
- [x] 3.47 `usage.ts`: `recomputeStorage(studio)`, `addBytes()`, `subtractBytes()`, `getUsage()`.
- [x] 3.48 `usage.ts`: remove `LimitError` and assert helpers (no caps).

Galleries
- [x] 3.49 `gallery-access.ts`: code and password checking, cookie grant per gallery, expiry check.
- [x] 3.50 `gallery-access.ts`: download PIN check, pay-gate check (`order balance == 0` or gallery not gated), sharing flag.
- [x] 3.51 `gallery-access.ts`: rate-limited unlock attempts and lockout per gallery + ip.
- [x] 3.52 `galleries.ts`: create, update settings, publish, unpublish, regenerate code, duplicate to finals from favorites, expire, counts.
  - [x] 3.52.1 createGallery(studio, input)
  - [x] 3.52.2 updateGallerySettings(id, patch)
  - [x] 3.52.3 publishGallery(id) / unpublishGallery(id)
  - [x] 3.52.4 regenerateAccessCode(id)
  - [x] 3.52.5 duplicateFinalsFromFavorites(id)
  - [x] 3.52.6 expireGalleries(now) for cron
  - [x] 3.52.7 galleryCounts(id) photos, favorites, unresolved notes
- [x] 3.53 `galleries.ts`: team event helpers: create parent, bulk-create children from a names list, per-child codes, summary.
- [x] 3.54 `photos.ts`: begin upload, complete upload (record, variants, usage), reorder, rename, soft delete, restore, purge.
  - [x] 3.54.1 beginUpload(gallery, filename, size, sha256)
  - [x] 3.54.2 completeUpload(photoId) variants + usage
  - [x] 3.54.3 reorderPhotos(gallery, ids)
  - [x] 3.54.4 renamePhoto(id, filename)
  - [x] 3.54.5 softDeletePhoto(id) / restorePhoto(id)
  - [x] 3.54.6 purgeDeleted(olderThan) for cron
  - [x] 3.54.7 movePhoto(id, targetGallery)
- [x] 3.55 `zip.ts`: streaming zip (fflate) of originals or web size, with filename de-duplication.
- [x] 3.56 `analytics.ts`: `track(kind, key, visitorHash)` deduped per day; `summary(studio, range)`.
- [x] 3.57 `analytics.ts` exists with record and summaries (extend per 3.56).

CRM and sales
- [x] 3.58 `clients.ts`: create, update, stage change, tag add/remove, merge by email, archive, search.
  - [x] 3.58.1 createClient(studio, input) with email dedupe
  - [x] 3.58.2 updateClient(id, patch)
  - [x] 3.58.3 setStage(id, stage) with event
  - [x] 3.58.4 addTag/removeTag(id, tag)
  - [x] 3.58.5 mergeClients(keepId, dropId) moving all references
  - [x] 3.58.6 archiveClient/restoreClient(id)
  - [x] 3.58.7 searchClients(studio, q, filters, cursor)
- [x] 3.59 `clients.ts`: `recordEvent(clientId, kind, ref)` feeding `client_events`.
- [x] 3.60 `orders.ts`: create from package, next order number (per studio, transactional), update, cancel, schedule, agreement sign.
  - [x] 3.60.1 createOrder(studio, client, package, when) inside a transaction taking next_order_number
  - [x] 3.60.2 updateOrder(id, patch) with recompute rules
  - [x] 3.60.3 cancelOrder(id, reason)
  - [x] 3.60.4 rescheduleOrder(id, when)
  - [x] 3.60.5 signAgreement(id, name, ip, version)
  - [x] 3.60.6 orderSummary(id) for the session page
- [x] 3.61 `packages.ts`: CRUD and ordering.
- [x] 3.62 `agreements.ts`: render template with variables, versioning, `CONTRACT_VERSION` per studio template.
- [x] 3.63 `tasks.ts`: CRUD, due today, overdue.
- [x] 3.64 `csv.ts`: export clients and payments; parse client CSV with column mapping and validation report.
- [x] 3.65 `ical.ts`: studio sessions feed with token.

Website
- [x] 3.66 `site/schema.ts`: zod schemas for site settings (template, colors, font, logo asset, favicon asset), page sections per page, area pages, SEO.
  - [x] 3.66.1 siteSettingsSchema (template, colors, base, font, logo, favicon)
  - [x] 3.66.2 homeSectionsSchema
  - [x] 3.66.3 portfolioPageSchema
  - [x] 3.66.4 pricingPageSchema
  - [x] 3.66.5 aboutPageSchema
  - [x] 3.66.6 contactPageSchema
  - [x] 3.66.7 galleryPageSchema and bookPageSchema
  - [x] 3.66.8 areasSchema
  - [x] 3.66.9 seoSchema
- [x] 3.67 `site/defaults.ts`: starter copy per section, adapted from the current studio site, with `{studio}` and `{location}` placeholders.
  - [x] 3.67.1 Home defaults
  - [x] 3.67.2 Portfolio defaults
  - [x] 3.67.3 Pricing defaults
  - [x] 3.67.4 About defaults
  - [x] 3.67.5 Contact defaults
  - [x] 3.67.6 FAQ default questions (8)
- [x] 3.68 `site/theme.ts`: CSS variables from colors and base; contrast check helper.
- [x] 3.69 `site/publish.ts`: draft → live copy, validation, `site_published_at`.
- [x] 3.70 `site/seo.ts`: title and description resolution, LocalBusiness JSON-LD, OG image URL.
- [x] 3.71 Delete old block schemas from `site.ts`.
- [x] 3.72 `site` tests: defaults validate, publish rejects invalid draft, theme contrast fails on bad pairs.

Email
- [x] 3.73 `email.ts`: Resend send, `emailLayout()`, dry-run when not configured.
- [x] 3.74 `email.ts`: `senderFor(studio)` picks verified sending domain or platform default; always sets reply-to.
- [x] 3.75 `email.ts`: `sendStudioEmail()` logs to `email_log` with related ids; `sendPlatformEmail()` never uses studio domains.
- [x] 3.76 `email.ts`: suppression check before send; unsubscribe header and footer link for broadcasts.
- [x] 3.77 `email-templates.ts`: keys, defaults, variables, `renderTemplate`, `resolveTemplate`.
- [x] 3.78 `email-templates.ts`: add keys `booking_confirmed`, `booking_reminder`, `import_finished`, `session_plan_shared`.
- [x] 3.79 `emails/account.ts` (verify, reset, invite) and `emails/studio.ts` (studio-originated).
- [x] 3.80 `emails/billing.ts`: trial ending, trial ended, payment failed, subscription cancelled, referral earned.
- [x] 3.81 `sending-domains.ts`: `createDomain(studio, domain)`, `getDomain()`, `verifyDomain()`, `deleteDomain()`, `mapStatus()`, `dnsRows()`, `dmarcSuggestion()`.
  - [x] 3.81.1 createDomain(studio, domain) → Resend POST /domains
  - [x] 3.81.2 getDomain(id) → records and status
  - [x] 3.81.3 verifyDomain(id) → Resend POST /domains/{id}/verify
  - [x] 3.81.4 deleteDomain(id)
  - [x] 3.81.5 mapStatus(resendStatus) → our enum
  - [x] 3.81.6 dnsRows(records) → host, type, value, ttl
  - [x] 3.81.7 dmarcSuggestion(domain)
- [x] 3.82 `sending-domains.ts` tests: status mapping, record formatting.
- [x] 3.83 `automations.ts`: rules registry (balance reminder, gallery expiring, unanswered notes, review request, thank you), `due(rule)`, `markSent()`.

Referrals, imports, booking, planning
- [x] 3.84 `referrals.ts`: `generateCode()`, `captureAtSignup()`, `onFirstPaidInvoice()`, `applyReward(studio)`, `queueReward()`, `void()`.
  - [x] 3.84.1 generateCode() 8 chars, unambiguous alphabet, unique
  - [x] 3.84.2 captureAtSignup(studio, code)
  - [x] 3.84.3 onFirstPaidInvoice(studio, invoice)
  - [x] 3.84.4 applyReward(studio, couponId) or queue
  - [x] 3.84.5 queueReward(studio, reason, applyAfter)
  - [x] 3.84.6 voidReferral(id, reason)
- [x] 3.85 `referrals.ts` fraud checks: same user, same email, same payment method fingerprint (from Stripe customer default payment method), cap 12 per year.
- [x] 3.86 `referrals.ts` tests for each rule.
- [x] 3.87 `imports.ts`: create import, accept zip uploads, scan entries, map folders to galleries, stream photos into storage, progress, finish, log.
  - [x] 3.87.1 createImport(studio, source)
  - [x] 3.87.2 registerFile(importId, blob)
  - [x] 3.87.3 scanZip(file) → entries grouped by folder
  - [x] 3.87.4 proposeGalleries(entries) → titles, counts
  - [x] 3.87.5 processChunk(importId, n) idempotent
  - [x] 3.87.6 finishImport(importId) summary and email
- [x] 3.88 `imports/pixieset.ts`, `imports/pictime.ts`, `imports/shootproof.ts`: folder naming conventions and client CSV shapes (documented from their export formats; where a format cannot be verified, treat as plain zip).
- [x] 3.89 `booking.ts`: availability from weekly hours minus existing slots and buffers, slot generation per package duration, hold for 15 minutes, confirm, cancel.
  - [x] 3.89.1 weeklyHours → slots for a date
  - [x] 3.89.2 subtract existing slots and buffers
  - [x] 3.89.3 apply lead time and max per day
  - [x] 3.89.4 holdSlot(studio, start, package) 15 min
  - [x] 3.89.5 confirmSlot(holdId, order)
  - [x] 3.89.6 releaseExpiredHolds()
- [x] 3.90 `booking.ts` tests: overlaps, buffers, lead time, timezone edge at DST.
- [x] 3.91 `planning.ts`: session plan CRUD, shot list toggle, mood board asset add/remove, client-visible flag.

Validation and types
- [x] 3.92 `validation.ts`: zod v4 schemas for signup, login, client, package, order, gallery, template, settings.
- [x] 3.93 `validation.ts`: schemas for booking settings, sending domain, referral code, import mapping, session plan, broadcast filter.
- [x] 3.94 `types.ts`: row types and money helpers.
- [ ] 3.95 `types.ts`: types for the new tables; `Money` helpers moved to `payments.ts`.
- [ ] 3.96 Unit tests for every pure helper added in this phase (target 90% of `lib/`).

## Phase 4. Routing shell and design system

- [x] 4.1 `proxy.ts`: host classification, tenant rewrite, custom-domain lookup with 60 s cache, noindex outside production and on tenant galleries, optimistic redirects for `/studio` and `/admin` without a session cookie.
- [x] 4.2 `proxy.ts`: pass `x-tenant-slug` and `x-tenant-host` headers to server components.
- [x] 4.3 `proxy.ts`: maintenance banner flag from `platform_settings` (cached) surfaced as a header.
- [x] 4.4 Root `layout.tsx`, `globals.css` tokens (light app, dark gallery, tenant brand var).
- [x] 4.5 `components/ui`: Button, ButtonLink, Input, Textarea, Select, Field, Card, Badge, PageHeader, EmptyState, Notice, Table, Stat, Meter, Logo, `cx`.
- [x] 4.6 `components/forms`: SubmitButton, FormMessage, ConfirmButton, CopyButton.
- [x] 4.7 `not-found.tsx`, `error.tsx`, `studio-not-found/page.tsx`.
- [x] 4.8 `loading.tsx` skeletons for `/studio`, `/t/[slug]/g/[slug]`, `/admin`.
- [x] 4.9 Toast provider and `useToast()`; Server Action results trigger toasts.
- [x] 4.10 Dialog component (focus trap, Escape, backdrop click, aria labels).
- [x] 4.11 Drawer component for side panels (photo notes, client quick view).
- [x] 4.12 Tabs component with URL sync.
- [x] 4.13 Dropdown menu component (keyboard navigable).
- [x] 4.14 Icon set as inline SVG components (24 icons used across the app).
- [ ] 4.15 `ImagePicker`: choose from asset library or upload; returns asset id; used by site editor, branding, portfolio, mood board.
- [x] 4.16 `ColorField`: hex input plus swatches plus contrast warning against white and black.
- [x] 4.17 `DateTimeField` honoring studio timezone.
- [x] 4.18 `MoneyField` in studio currency.
- [x] 4.19 `Pagination` component and `paginate()` helper (cursor by created_at, id).
- [x] 4.20 `SearchInput` with debounce and URL sync.
- [x] 4.21 `DataTable` wrapper: sortable headers, empty state, row actions.
- [x] 4.22 `Uploader` component: drag and drop, file list, progress bars, retries, cancel, direct-to-Blob.
  - [x] 4.22.1 Drop zone and file input with accept list
  - [x] 4.22.2 Queue with per-file status
  - [x] 4.22.3 Concurrency limit 4 uploads
  - [x] 4.22.4 Retry with backoff, max 3
  - [x] 4.22.5 Cancel single and cancel all
- [x] 4.23 `Lightbox` component: keyboard, swipe, zoom, captions, favorite and note buttons slot.
  - [x] 4.23.1 Open at index, close, next and previous
  - [x] 4.23.2 Keyboard: arrows, Escape, F for favorite
  - [x] 4.23.3 Touch swipe
  - [x] 4.23.4 Pinch and double-tap zoom
  - [x] 4.23.5 Slots for favorite, note, download buttons
- [x] 4.24 `Stepper` for onboarding and import wizards.
- [ ] 4.25 Dark theme tokens verified for contrast on gallery pages.
- [x] 4.26 Print stylesheet for invoices, receipts and agreements.
- [x] 4.27 Storybook-free component gallery page at `/dev/ui` (only when `NODE_ENV !== production`).

## Phase 5. Authentication and accounts

- [x] 5.1 `(auth)/layout.tsx` centered card.
- [x] 5.2 `(auth)/actions.ts`: signup, login, logout, forgot, reset, resend verification, accept invite, switch studio, create studio, slug check.
- [x] 5.3 `/signup` with live slug check and password guidance.
- [x] 5.4 `/signup?ref=CODE`: read code from query, set cookie `ref` (30 days), show "Referred by {Studio}: you both get 10% off for 12 months".
- [x] 5.5 Signup action: store `referred_by_code`, create `referrals` row as `signed_up`, ignore invalid or self codes silently.
- [x] 5.6 Signup action: honeypot field and rate limit by ip and email.
- [x] 5.7 Signup: studio name, your name, email, password, subdomain; timezone auto-detected client side and posted.
- [x] 5.8 `/login` with `next` redirect and generic error text.
- [x] 5.9 `/login`: lockout message with minutes remaining; link to reset.
- [x] 5.10 `/forgot-password` (always says "if the account exists").
- [x] 5.11 `/reset-password?token=` with strength check and session revoke on success.
- [x] 5.12 `/verify-email` route consumes token, marks verified, redirects with banner.
- [x] 5.13 `/logout` route.
- [x] 5.14 `/invite/[token]`: new user sets password; existing user joins.
- [x] 5.15 Invite page: expired and already-accepted states.
- [x] 5.16 `/api/slug-check`.
- [x] 5.17 `/account` page: name, email, password, sessions, danger zone.
- [x] 5.18 Change email: send verification to the new address, switch on confirm, notify old address.
- [x] 5.19 Change password: requires current password; revokes other sessions.
- [x] 5.20 Active sessions list with device, last seen, revoke button.
- [x] 5.21 Delete account: blocked if sole owner of a live studio (explain), else soft delete and sign out.
- [x] 5.22 Verification banner with resend, rate limited.
- [x] 5.23 Session cookie: `SameSite=Lax`, `Secure` in production, host-only (no Domain attribute), so browsers never send it to tenant subdomains or custom domains.
- [x] 5.24 Auth pages `metadata` (noindex) and titles.
- [x] 5.25 Tests: password rules, token consume-once, lockout counter, slug reserved list.
- [ ] 5.26 Onboarding redirect: first login after signup goes to `/studio/welcome`.

## Phase 6. Platform subscription (our $40/month)

- [x] 6.1 `/studio/billing` page: state badge (trial with days left, active, past due, read-only), price, next invoice date, card on file (last 4), invoices list.
- [x] 6.2 "Start subscription" button → `POST /api/billing/checkout` (Stripe Checkout, subscription mode, `customer` created if missing, trial end carried over if still in trial, referral coupon applied if a pending reward exists).
- [x] 6.3 "Manage billing" → `POST /api/billing/portal` (Customer Portal configured for card update and cancel).
- [x] 6.4 `/studio/billing/success` and `/studio/billing/cancelled` pages.
- [x] 6.5 `POST /api/stripe/webhook`: verify signature, idempotency via `stripe_events`, handle `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`.
  - [x] 6.5.1 checkout.session.completed (subscription mode) → link customer and subscription
  - [x] 6.5.2 customer.subscription.created → status, period
  - [x] 6.5.3 customer.subscription.updated → status, cancel flag, period
  - [x] 6.5.4 customer.subscription.deleted → cancelled, start retention clock
  - [x] 6.5.5 invoice.paid → active, clear read-only, referral hook
  - [x] 6.5.6 invoice.payment_failed → past_due, email
- [x] 6.6 Webhook maps subscription status to studio columns; clears `read_only_since` on active.
- [x] 6.7 `invoice.paid` for a studio's first paid invoice calls `referrals.onFirstPaidInvoice()`.
- [x] 6.8 Trial banner in studio shell: days left, subscribe link; turns red at 3 days.
- [x] 6.9 Read-only mode: `requireWritableStudio` blocks mutations; UI shows a persistent notice with the subscribe button; galleries and site stay live through grace.
- [ ] 6.10 Grace end: cron locks galleries (status stays, access page shows "This gallery is temporarily unavailable, contact {Studio}").
- [x] 6.11 Cancellation: `cancel_at_period_end` shown with date and "resume" via portal.
- [ ] 6.12 Data retention: 90 days after cancellation, cron purges the studio (blobs then rows) and emails the owner 14 and 3 days before.
- [x] 6.13 Emails: trial ending in 3 days, trial ended, payment failed (with portal link), subscription cancelled, purge warning.
  - [x] 6.13.1 Trial ends in 3 days
  - [x] 6.13.2 Trial ended (read-only starts)
  - [x] 6.13.3 Payment failed with portal link
  - [x] 6.13.4 Subscription cancelled with end date
  - [x] 6.13.5 Purge warning at 14 and 3 days
- [x] 6.14 Invoice PDF links from Stripe shown on the billing page.
- [x] 6.15 Billing page copy explains: one plan, everything included, unlimited seats, cancel any time.
- [ ] 6.16 Platform admin can extend a trial or comp a studio (sets `plan_override = comped`); billing page reflects it.
- [ ] 6.17 Tests: webhook handlers with fixture events; read-only transitions.
- [x] 6.18 `docs/SETUP.md` section: create the product and price, Customer Portal settings (allow cancel, allow card update, no plan switching), webhook endpoint for account events.

## Phase 7. Studio's Stripe connection and client payments

- [x] 7.1 `/studio/settings/payments` page with three states: not connected, connecting (details not submitted or charges disabled), connected (account id, charges enabled, link to their Stripe Dashboard).
  - [x] 7.1.1 Not connected: two buttons and the plain-language box
  - [x] 7.1.2 Connecting: 'finish setup in Stripe' button (new Account Link) and what is missing
  - [x] 7.1.3 Connected: account id, charges enabled badge, Dashboard link, disconnect
- [x] 7.2 Plain-language box: "Payments go straight to your Stripe account. We never hold your money and never take a cut. Refunds and disputes are handled in your own Stripe Dashboard."
- [x] 7.3 Button "Connect existing Stripe account" → `GET /api/connect/oauth/start` (signed state, prefill email, business name, website URL).
- [x] 7.4 `GET /api/connect/oauth/callback`: verify state, exchange code, store `stripe_account_id`, method `oauth`, refresh status, audit, redirect with toast.
- [x] 7.5 Callback error handling: `access_denied` → friendly message; expired code → retry link.
- [x] 7.6 Button "Create a new Stripe account" → `POST /api/connect/onboard`: create account (defaults), Account Link with return and refresh URLs, redirect.
- [x] 7.7 `GET /api/connect/return`: refresh status, show "finish setup" if `details_submitted` is false.
- [x] 7.8 `GET /api/connect/refresh`: new Account Link and redirect.
- [x] 7.9 "Disconnect" button: OAuth → deauthorize; onboarding → clear id; confirm dialog explains existing payment records stay.
- [x] 7.10 Manual mode toggle: "I'll collect payment myself" with instructions text and optional Payment Link URL; pay page shows these instead of Checkout.
- [x] 7.11 `POST /api/stripe/connect-webhook` (endpoint created with "Events from: Connected accounts"): verify with `STRIPE_CONNECT_WEBHOOK_SECRET`, read `event.account`, idempotency, dispatch.
- [x] 7.12 Handle `checkout.session.completed` and `checkout.session.async_payment_succeeded`: record payment, mark deposit or balance paid, unlock pay-gated galleries, send receipt, client event.
- [x] 7.13 Handle `checkout.session.async_payment_failed`: mark attempt failed, email studio.
- [x] 7.14 Handle `charge.refunded`: set `refunded_cents`, order status, client event, notify studio.
- [x] 7.15 Handle `charge.dispute.created|closed`: set dispute status, notify studio with a link to their Dashboard.
- [x] 7.16 Handle `account.updated`: refresh `charges_enabled`, `details_submitted`.
- [x] 7.17 Handle `account.application.deauthorized`: clear connection, notify owner.
- [x] 7.18 `POST /api/pay/checkout` (tenant): validate order belongs to the host's studio, choose deposit, balance or full, create Checkout Session on the studio's account with `Stripe-Account`, no application fee, studio branding, metadata, redirect.
- [x] 7.19 Checkout Session details: customer email prefilled, `payment_intent_data.description` with order number, statement descriptor left to the studio's account settings.
- [ ] 7.20 Success page reads the session on the studio's account, shows "You paid {Studio}", amount, and next steps; cancel page returns to the order.
- [ ] 7.21 Studio-side session page: payments list with method, amount, status, refund and dispute badges, "View in Stripe" link (`https://dashboard.stripe.com/payments/{id}`), no refund button.
- [x] 7.22 Receipt email from us after each successful payment (in addition to Stripe's own receipt if the studio enabled it).
- [x] 7.23 Test mode notice: when platform keys are test keys, pay pages show a test badge.
- [ ] 7.24 Tests: OAuth state signing and expiry; webhook dispatch by event type; pay checkout rejects orders from another studio.
- [x] 7.25 `docs/SETUP.md` section from Appendix A (platform profile, branding, OAuth redirect URIs, connect webhook).
- [x] 7.26 Stripe CLI recipes in docs: `stripe listen --forward-connect-to localhost:3000/api/stripe/connect-webhook` and `stripe trigger --stripe-account acct_x checkout.session.completed`.

## Phase 8. Marketing site (root domain)

- [x] 8.1 `(marketing)/layout.tsx`: header with logo, nav (Features, Pricing, Lightroom, Compare, Log in, Start free), footer with legal links and status.
- [x] 8.2 Mobile nav (hamburger, focus trap, closes on route change) tested on a 375 px viewport.
- [x] 8.3 Home hero: "Cull in Lightroom. Deliver in one click. Get paid in your own Stripe." with two CTAs and a product screenshot placeholder swapped for real screenshots at Phase 22.
- [x] 8.4 Home: three-step section (shoot, publish from Lightroom, client picks and pays).
- [x] 8.5 Home: feature grid (website templates, galleries, CRM, payments in your Stripe, email from your domain, team days, booking, import).
- [x] 8.6 Home: "Your money is yours" section explaining 0% commission and own Stripe.
- [x] 8.7 Home: Lightroom plugin section with screenshot.
- [x] 8.8 Home: pricing teaser ($40/month, everything included, 14-day trial).
- [x] 8.9 Home: FAQ (8 questions) and final CTA.
- [x] 8.10 `/pricing`: single plan card, full feature list, "everything included" table, FAQ, referral note.
- [x] 8.11 `/features/website`, `/features/galleries`, `/features/crm`, `/features/payments`, `/features/lightroom`, `/features/team-headshots`, `/features/booking`, `/features/email`.
  - [x] 8.11.1 /features/website
  - [x] 8.11.2 /features/galleries
  - [x] 8.11.3 /features/crm
  - [x] 8.11.4 /features/payments
  - [x] 8.11.5 /features/lightroom
  - [x] 8.11.6 /features/team-headshots
  - [x] 8.11.7 /features/booking
  - [x] 8.11.8 /features/email
- [x] 8.12 `/compare/pixieset`, `/compare/pic-time`, `/compare/shootproof`, `/compare/cloudspot`, `/compare/honeybook` with tables from `docs/MARKET-RESEARCH.md` and a "last checked" date.
  - [x] 8.12.1 /compare/pixieset
  - [x] 8.12.2 /compare/pic-time
  - [x] 8.12.3 /compare/shootproof
  - [x] 8.12.4 /compare/cloudspot
  - [x] 8.12.5 /compare/honeybook
- [x] 8.13 `/lightroom`: install guide, screenshots, download link (requires login for the actual zip).
- [x] 8.14 `/security`: data handling, storage, payments never touched, backups.
- [x] 8.15 `/terms`, `/privacy`, `/cookies`, `/dpa`, `/referrals` (program terms), `/fair-use`. Company legal name and governing law are placeholders (`COMPANY`, `JURISDICTION` in `components/marketing/legal-content.tsx`) until counsel reviews; see 22.x launch list.
  - [x] 8.15.1 /terms
  - [x] 8.15.2 /privacy
  - [x] 8.15.3 /cookies
  - [x] 8.15.4 /dpa
  - [x] 8.15.5 /referrals
  - [x] 8.15.6 /fair-use
- [x] 8.16 `/contact`: form to `leads`, rate limit, honeypot, notice email to `PLATFORM_ALERT_EMAIL`.
- [x] 8.17 `/changelog` rendering `CHANGELOG.md`.
- [x] 8.18 `sitemap.ts`, `robots.ts` (disallow `/studio`, `/admin`, `/api`).
- [x] 8.19 `opengraph-image.tsx` and per-page metadata.
- [x] 8.20 JSON-LD Organization and SoftwareApplication.
- [x] 8.21 Marketing analytics: page view beacon to `analytics_daily` with `studio_id null`. Built as its own table `marketing_views_daily (day, path, referrer, count)` because `analytics_daily` keys on a non-null `studio_id`.
- [x] 8.22 Signup CTA carries `?ref=` through from marketing pages.
- [x] 8.23 Accessibility pass: landmarks, skip link, focus styles, contrast, alt text.
- [ ] 8.24 Lighthouse run recorded in docs (target 95+ performance, 100 accessibility). Runs at Phase 22 against a deployed preview.

## Phase 9. Studio shell, onboarding, dashboard

- [~] 9.1 `/studio/layout.tsx`: sidebar (Dashboard, Inbox, Clients, Sessions, Calendar, Galleries, Website, Portfolio, Assets, Emails, Bookings, Referrals, Settings), top bar with studio switcher and user menu.
- [ ] 9.2 Sidebar collapses on small screens; active item state; unread counts for Inbox and Notes.
- [x] 9.3 Studio switcher and "create another studio".
- [x] 9.4 Banners: email verification, trial, read-only, suspended.
- [x] 9.5 `/studio/welcome` wizard (Stepper): 1 brand (name, logo, color), 2 template pick with preview, 3 packages (edit the three defaults), 4 connect Stripe (skippable), 5 email sender, 6 install Lightroom (skippable), 7 done with checklist link.
  - [x] 9.5.1 Step 1 brand: name, logo upload, color
  - [x] 9.5.2 Step 2 template: pick Editorial or Gallery with preview
  - [x] 9.5.3 Step 3 packages: edit the three defaults
  - [x] 9.5.4 Step 4 payments: connect Stripe or skip
  - [x] 9.5.5 Step 5 email: display name and reply-to
  - [x] 9.5.6 Step 6 Lightroom: create token, download plugin, or skip
  - [x] 9.5.7 Step 7 done: link to checklist and website editor
- [x] 9.6 Onboarding checklist card with progress and dismiss.
- [x] 9.7 Checklist items link to the exact page and auto-check from data (logo set, template published, Stripe connected, first package, first client, first gallery, plugin token created, sending domain verified).
- [~] 9.8 Dashboard stats: live galleries, unanswered notes, unpaid balance total, sessions this week, storage used.
- [~] 9.9 Dashboard to-do list generated from data (unpaid balances, unanswered notes, expiring galleries, unread inquiries, tasks due).
  - [ ] 9.9.1 Unpaid balances due within 7 days
  - [ ] 9.9.2 Unanswered client notes
  - [ ] 9.9.3 Galleries expiring within 7 days
  - [ ] 9.9.4 Unread inquiries and booking requests
  - [ ] 9.9.5 Tasks due today or overdue
- [~] 9.10 Dashboard recent activity from audit log and client events.
- [ ] 9.11 Dashboard upcoming sessions (next 7 days) with client and package.
- [ ] 9.12 Global search box (clients, galleries, sessions by name, email, order number) with results page.
- [ ] 9.13 Keyboard shortcut `/` focuses search; `g c`, `g g`, `g s` jump to clients, galleries, sessions.
- [ ] 9.14 Empty states with one clear action for every list page.
- [ ] 9.15 Help menu: docs links, contact support, keyboard shortcuts.
- [ ] 9.16 Suspended state page (platform admin action) with support contact.

## Phase 10. CRM

Inbox
- [x] 10.1 `/studio/inbox`: list of inquiries and booking requests, unread first, filters (all, unread, archived).
- [x] 10.2 Inquiry detail drawer: message, contact, source, "reply by email" (opens composer with template), "convert to client", "archive".
- [x] 10.3 Reply composer: subject, body from template `inquiry_reply` with variables filled, send from the studio sender, logs to `email_log`, adds client event.
- [x] 10.4 Convert to client: creates or links client by email, moves stage to `lead`, keeps inquiry link.
- [x] 10.5 Bulk archive and mark read.
- [ ] 10.6 New inquiry notification email to the studio (respecting a per-user notification setting).

Clients
- [x] 10.7 `/studio/clients`: table with name, company, stage, last activity, balance due, tags; search; stage tabs; sort.
  - [x] 10.7.1 Columns and row link
  - [x] 10.7.2 Search by name, email, company
  - [x] 10.7.3 Stage tabs with counts
  - [x] 10.7.4 Sort by name, last activity, balance
  - [x] 10.7.5 Cursor pagination
  - [x] 10.7.6 Empty state with add and import actions
- [x] 10.8 Add client dialog (name, email, phone, company, stage, tags, source).
- [x] 10.9 Edit client inline fields.
- [x] 10.10 Stage pipeline: lead → booked → delivered → repeat; change from list and detail.
- [x] 10.11 Tags: create, assign, filter, rename, delete.
- [x] 10.12 Archive and restore client.
- [~] 10.13 Merge duplicates: detect same email, preview merged record, merge sessions, galleries, notes, events.
- [x] 10.14 CSV export (current filter).
- [ ] 10.15 CSV import wizard: upload, map columns, preview, validate, import, report.
  - [ ] 10.15.1 Upload CSV and detect delimiter
  - [ ] 10.15.2 Map columns to fields with auto-guess
  - [ ] 10.15.3 Preview first 20 rows with validation flags
  - [ ] 10.15.4 Import with duplicate policy (skip, update)
  - [ ] 10.15.5 Report: created, updated, skipped, errors CSV
- [x] 10.16 `/studio/clients/[id]` header: contact, stage, tags, quick actions (new session, new gallery, email, task).
- [~] 10.17 Client timeline: notes, emails, payments, galleries, bookings, system events, filter by type.
  - [ ] 10.17.1 Notes
  - [ ] 10.17.2 Emails sent (with status)
  - [ ] 10.17.3 Payments and refunds
  - [ ] 10.17.4 Galleries created, sent, opened
  - [ ] 10.17.5 Bookings and sessions
  - [ ] 10.17.6 Automations sent
  - [ ] 10.17.7 System events (stage change, merge)
- [x] 10.18 Notes: add, edit, delete own, pin.
- [x] 10.19 Log a call or meeting (kind + summary) into the timeline.
- [x] 10.20 Client tasks tab and "add task" from anywhere.
- [x] 10.21 Client sessions tab: list with money summary, create from package.
- [x] 10.22 Client galleries tab: list with status, picks count, unresolved notes.
- [ ] 10.23 Client documents tab: agreements, receipts, uploads.
- [ ] 10.24 Client hub link (magic link email) button.
- [ ] 10.25 Unsubscribed indicator and manual unsubscribe/resubscribe with reason.
- [ ] 10.26 Client "send email" composer with template picker, variables, attachments from documents.

Tasks
- [x] 10.27 `/studio/tasks`: my tasks, all tasks, overdue, done; create, complete, reassign, due date.
- [ ] 10.28 Task reminders email (daily digest of due today and overdue).

Broadcasts
- [ ] 10.29 `/studio/emails/broadcasts`: list, new broadcast (filter by stage, tag, last activity), subject, body with variables, test send, schedule or send now.
  - [ ] 10.29.1 Filter builder: stage, tags, last activity, has email
  - [ ] 10.29.2 Subject and body with variables and preview
  - [ ] 10.29.3 Recipient count preview
  - [ ] 10.29.4 Test send to me
  - [ ] 10.29.5 Send now or schedule
- [ ] 10.30 Broadcast send worker in cron (batches of 100, respects suppressions and unsubscribes, logs each).
- [ ] 10.31 Broadcast report: sent, delivered, opened, clicked, bounced, complaints (from Resend webhooks).
- [ ] 10.32 Unsubscribe page `/u/[token]` on the tenant host, one click, confirmation.

CRM quality
- [ ] 10.33 Tests: merge logic, CSV mapping, stage transitions, unsubscribe enforcement.
- [ ] 10.34 Audit entries for client create, merge, delete, export.

## Phase 11. Packages, sessions, agreements, payments UI

- [x] 11.1 `/studio/packages`: list with price, deposit, finals included, active, on-site; drag to reorder.
- [x] 11.2 Package form: name, description, price, deposit (fixed or percent), included finals, extra final price, duration, active, show on site.
- [x] 11.3 Package archive (kept for existing orders).
- [x] 11.4 `/studio/sessions`: tabs upcoming, unpaid, past, all; columns date, client, package, total, paid, balance, agreement.
- [x] 11.5 New session dialog: client (search or create), package, date and time (studio timezone), location, notes; creates order with next number.
- [x] 11.6 `/studio/sessions/[id]`: header (order number, client, date, status), money card (total, deposit, paid, balance), agreement card, galleries card, plan card (Phase 21), timeline.
  - [x] 11.6.1 Header card
  - [x] 11.6.2 Money card
  - [x] 11.6.3 Agreement card
  - [x] 11.6.4 Galleries card
  - [~] 11.6.5 Plan card (Phase 21)
  - [x] 11.6.6 Timeline
- [x] 11.7 Edit session: reschedule, change package (recompute totals unless payments exist, then warn), discount, notes.
- [x] 11.8 Cancel session with reason; keeps payments history.
- [x] 11.9 Payment link: copy, email (template `payment_link`), QR code (SVG) for in person.
- [x] 11.10 Manual payment dialog: amount, method (cash, transfer, other), note; undo within 24 hours.
- [x] 11.11 Payments list on the session with statuses and Stripe links (see 7.21).
- [~] 11.12 Agreement: view rendered text, signed copy with name, time, ip; resend link; regenerate if unsigned and template changed.
- [ ] 11.13 `/studio/settings/agreement`: template editor (Markdown), variables list, preview, save as new version.
- [ ] 11.14 Printable invoice `/t/[slug]/invoice/[token]` and receipt `/t/[slug]/receipt/[token]` (client-facing, token in email).
- [ ] 11.15 `/studio/calendar`: month and week views of sessions and confirmed bookings; click to open; today marker.
- [ ] 11.16 iCal feed `/api/ical/[token]` for the studio calendar; regenerate token.
- [ ] 11.17 Session reminder emails to client (day before) and studio (morning of), toggles in automations.
- [ ] 11.18 Sessions CSV export.
- [ ] 11.19 Tests: order numbering under concurrency (transaction), money math with discounts and refunds, agreement versioning.

## Phase 12. Galleries and proofing (studio side)

List and create
- [x] 12.1 `/studio/galleries`: grid or table toggle; filters kind (proofs, finals, team), status, client; counts; search.
- [x] 12.2 New gallery dialog: client, session (optional), kind, title (default from client and date), template of settings (proofs vs finals presets).
- [x] 12.3 Gallery slug generated from title, editable before publish.

Settings
- [x] 12.4 `/studio/galleries/[id]/settings`: title, kind, welcome text, cover photo, sort mode (manual, filename, capture time).
- [x] 12.5 Access: access code (show, regenerate), or password, or open link; expiry date; download PIN.
- [x] 12.6 Downloads: off, web size, full size, both; pay-gated toggle (requires linked order).
- [x] 12.7 Comments on/off; favorites limit (from package included finals) with soft warning when exceeded.
- [x] 12.8 Watermark toggle (previews re-rendered in background job).
- [x] 12.9 Sharing toggle; client upload toggle.
- [x] 12.10 Publish, unpublish, archive, delete (with photo purge after 30 days).

Upload and photos
- [x] 12.11 Uploader: select or drop many files, client-side validation (jpg, png, heic converted server-side, max 60 MB each), direct upload with token, progress, retry, cancel.
  - [x] 12.11.1 Client-side type and size validation
  - [ ] 12.11.2 HEIC converted to JPEG server-side
  - [x] 12.11.3 Upload token per file
  - [x] 12.11.4 Progress per file and overall
  - [x] 12.11.5 Retry failed files
  - [x] 12.11.6 Cancel remaining
- [x] 12.12 Server complete step: variants, sha256, duplicate warning, usage add, sort append.
- [~] 12.13 Photo grid: lazy thumbnails, select mode, drag reorder (or move up/down buttons), rename, delete, set as cover.
  - [ ] 12.13.1 Lazy thumbnail grid with virtualization above 200 photos
  - [ ] 12.13.2 Select mode with shift-click range
  - [ ] 12.13.3 Drag reorder and move up/down fallback
  - [ ] 12.13.4 Rename inline
  - [x] 12.13.5 Delete with undo toast
  - [x] 12.13.6 Set as cover
- [~] 12.14 Bulk actions: delete, move to another gallery of the same client, download originals.
- [ ] 12.15 Photo detail drawer: larger preview, filename, size, dimensions, capture time (EXIF), notes thread, favorite state.
- [ ] 12.16 Background job for variant regeneration (watermark toggle, missing variants) via `/api/cron/frequent`.
- [ ] 12.17 Trash view for soft-deleted photos with restore.

Proofing tools
- [x] 12.18 Notes panel: all threads, unresolved filter, reply, resolve, jump to photo.
- [x] 12.19 Favorites list: count vs included, export CSV of filenames, "copy filenames" for Lightroom, "create finals gallery from favorites".
  - [x] 12.19.1 Count vs included finals
  - [~] 12.19.2 Export CSV of filenames
  - [~] 12.19.3 Copy filenames to clipboard (Lightroom text filter format)
  - [x] 12.19.4 Create finals gallery from favorites
- [ ] 12.20 Client activity: last opened, views, downloads, per-photo download counts.
- [x] 12.21 Send gallery email (proofs ready or finals ready template) with preview and code; logs and client event.
  - [x] 12.21.1 Pick template (proofs ready or finals ready)
  - [x] 12.21.2 Preview with variables filled and access code
  - [x] 12.21.3 Send and log; client event
- [ ] 12.22 Resend or send to an additional address.
- [x] 12.23 Preview as client button (opens tenant URL with a preview token, never indexed).

Team events
- [ ] 12.24 New team event: title, client (company), date, list of names (paste or CSV), per-person galleries created with codes.
- [ ] 12.25 Event page: people table (name, code, status, picks, notes), add person, remove person, bulk send emails, manager summary link.
- [ ] 12.26 Upload to a person's gallery from the event page; move photo between people.
- [ ] 12.27 Event export: CSV of names, codes, favorites.

Quality
- [ ] 12.28 Gallery expiry automation and reminder email (7 days, 1 day).
- [ ] 12.29 Tests: access rules, favorites limit warning, slug uniqueness per studio, cover photo fallback.
- [ ] 12.30 Load test note: 300-photo gallery page renders under 1 s server time locally.

## Phase 13. Tenant client surfaces (`/t/[slug]`)

- [x] 13.1 Tenant `layout.tsx`: theme CSS variables from the studio's site settings, logo, nav from enabled pages, footer, "Powered by" line (small, always on for now).
- [x] 13.2 Tenant `not-found` and `error` pages branded.
- [x] 13.3 `/g`: enter access code page.
- [x] 13.4 `/g/[slug]` locked state: code or password form, rate limited, lockout message.
- [x] 13.5 `/g/[slug]` gallery: header (title, welcome, counts), grid with lazy thumbs, lightbox.
  - [x] 13.5.1 Header with title, welcome, counts
  - [x] 13.5.2 Grid with lazy thumbs and aspect ratios
  - [x] 13.5.3 Lightbox wired to favorite and note actions
  - [x] 13.5.4 Sticky action bar
- [x] 13.6 Favorites: toggle per photo, favorites filter, limit message from package.
- [x] 13.7 Notes: per photo thread, client name remembered in cookie, studio replies shown.
- [x] 13.8 Downloads: single photo (web or full per settings), select many, whole gallery zip (streamed), PIN prompt when set.
- [x] 13.9 Pay gate: locked overlay with "Pay balance to unlock" button to the pay page; unlocks on webhook.
- [x] 13.10 Expired and closed states with studio contact.
- [x] 13.11 Slideshow mode (full screen, keyboard, autoplay, exit).
- [~] 13.12 Share sheet (copy link, email) when sharing is allowed; watermarked share image.
- [x] 13.13 Client upload area when enabled (drag and drop, limits, appears in studio as `uploaded_by=client`).
- [~] 13.14 Mobile layout: bottom action bar (favorites, download, notes), swipe in lightbox.
- [x] 13.15 `/pay/[orderId]`: order summary, agreement text with checkbox and typed name, choose deposit, balance or full, "Pay with card" → Checkout on the studio's account; manual mode shows instructions.
  - [x] 13.15.1 Order summary (package, date, total, paid)
  - [x] 13.15.2 Agreement text with checkbox and typed name
  - [x] 13.15.3 Choose deposit, balance or full
  - [x] 13.15.4 Pay with card → Checkout on the studio's account
  - [x] 13.15.5 Manual mode instructions
  - [x] 13.15.6 Error states (order cancelled, already paid)
- [x] 13.16 `/pay/[orderId]/success` and `/cancel`.
- [x] 13.17 `/team/[eventSlug]`: manager overview (people, status, picks) behind a manager code.
- [x] 13.18 `/my/[token]` client hub: galleries, sessions, payments, documents, bookings; magic link expires in 7 days, re-request form.
  - [x] 13.18.1 Galleries list with status
  - [x] 13.18.2 Sessions with dates
  - [x] 13.18.3 Payments with receipts
  - [x] 13.18.4 Documents
  - [~] 13.18.5 Bookings with reschedule and cancel
- [x] 13.19 `/invoice/[token]`, `/receipt/[token]` printable pages.
- [x] 13.20 `/u/[token]` unsubscribe.
- [x] 13.21 `GET /api/photo/[id]?size=`: access check (grant cookie or preview token), pay-gate check for full size, ETag, `Cache-Control: private`, streams from Blob.
  - [x] 13.21.1 Grant cookie check per gallery
  - [x] 13.21.2 Preview token check for studio preview
  - [x] 13.21.3 Pay-gate check for full size
  - [x] 13.21.4 ETag and 304 handling
  - [x] 13.21.5 Streaming from Blob with correct content type
- [x] 13.22 `GET /api/gallery/[id]/zip?size=`: access and PIN check, streaming, filename sanitization.
- [x] 13.23 `POST /api/track`: page and gallery views, downloads; visitor hash from ip + user agent + day salt.
- [x] 13.24 `noindex` on all gallery, pay, hub pages; `index` on website pages.
- [x] 13.25 Tests: access grant cookie scope per gallery, PIN, pay gate, zip filename dedupe.
- [x] 13.26 Accessibility: lightbox keyboard trap, alt text from filename, focus return.

## Phase 14. Tenant public website (two templates)

Templates and sections
- [ ] 14.1 `site/templates/editorial/*`: Header, Hero, Intro, PortfolioStrip, Packages, Testimonials, FAQ, Location, CTA, Footer, PageHero, Grid, Steps, ContactForm, GalleryLogin.
  - [ ] 14.1.1 Header
  - [ ] 14.1.2 Hero
  - [ ] 14.1.3 Intro
  - [ ] 14.1.4 PortfolioStrip
  - [ ] 14.1.5 Packages
  - [ ] 14.1.6 Testimonials
  - [ ] 14.1.7 FAQ
  - [ ] 14.1.8 Location
  - [ ] 14.1.9 CTA
  - [ ] 14.1.10 Footer
  - [ ] 14.1.11 PageHero
  - [ ] 14.1.12 Grid
  - [ ] 14.1.13 Steps
  - [ ] 14.1.14 ContactForm
  - [ ] 14.1.15 GalleryLogin
- [ ] 14.2 `site/templates/gallery/*`: the same section set with the dark, full-bleed design.
  - [ ] 14.2.1 Header
  - [ ] 14.2.2 Hero
  - [ ] 14.2.3 Intro
  - [ ] 14.2.4 PortfolioStrip
  - [ ] 14.2.5 Packages
  - [ ] 14.2.6 Testimonials
  - [ ] 14.2.7 FAQ
  - [ ] 14.2.8 Location
  - [ ] 14.2.9 CTA
  - [ ] 14.2.10 Footer
  - [ ] 14.2.11 PageHero
  - [ ] 14.2.12 Grid
  - [ ] 14.2.13 Steps
  - [ ] 14.2.14 ContactForm
  - [ ] 14.2.15 GalleryLogin
- [ ] 14.3 Section props are identical across templates so switching keeps content.
- [ ] 14.4 Home page assembly: hero, intro, portfolio strip, packages, testimonials, FAQ, location, CTA, each honoring `enabled`.
- [ ] 14.5 Portfolio page: page hero, category filter, grid, lightbox.
- [ ] 14.6 Pricing page: page hero, packages (active and show_on_site), "what's included" list, FAQ, CTA.
- [ ] 14.7 About page: page hero, bio with portrait, process steps, CTA.
- [ ] 14.8 Contact page: page hero, form (name, email, phone, message, preferred date), contact details, map link; submission → inquiry + booking request; rate limit; honeypot; thank-you state.
- [ ] 14.9 Open-your-gallery page in template styling (reuses 13.3).
- [ ] 14.10 Book page (Phase 21) styled by template.
- [ ] 14.11 Local area pages `/headshots/[town]`: templated copy with town name, portfolio strip, packages, CTA, FAQ; toggle per town; sitemap entries.
  - [ ] 14.11.1 Route and slug per town
  - [ ] 14.11.2 Templated copy with town name
  - [ ] 14.11.3 Portfolio strip and packages
  - [ ] 14.11.4 FAQ and CTA
  - [ ] 14.11.5 Sitemap entries and toggle
- [ ] 14.12 Nav builder: pages enabled appear in header; order fixed (Home, Portfolio, Pricing, About, Book, Contact, Gallery).
- [ ] 14.13 Footer: contact details, social links, legal line, "Powered by".
- [ ] 14.14 Theme: primary, accent, base (light or dark), font pairing (3 presets loaded from Google Fonts via `next/font`), logo, favicon.
- [ ] 14.15 Image handling: section images from assets with responsive `sizes`, blur placeholder, alt text.
- [ ] 14.16 Starter copy seeded on studio creation for every section, written for headshot studios, with `{studio}` and `{location}` filled.

Editor
- [ ] 14.17 `/studio/website`: two-column editor. Left: pages list with sections and on/off switches; right: live preview iframe of the draft (`/t/[slug]?draft=token`).
- [ ] 14.18 Section editor panel: text fields per section (heading, subheading, body, button label, button target), image picker, on/off.
  - [ ] 14.18.1 Text fields (heading, subheading, body)
  - [ ] 14.18.2 Button label and target (page or URL)
  - [ ] 14.18.3 Image picker with alt text
  - [ ] 14.18.4 On/off switch and reset to default
- [ ] 14.19 List editors for FAQ items, process steps, testimonials (pick from reviews), packages (pick from packages).
  - [ ] 14.19.1 FAQ items list editor
  - [ ] 14.19.2 Process steps list editor
  - [ ] 14.19.3 Testimonials picker from reviews
  - [ ] 14.19.4 Packages picker from packages
- [ ] 14.20 Appearance panel: template switch with side-by-side preview, colors with contrast check, base, font pairing, logo, favicon.
- [ ] 14.21 SEO panel: site title, description, OG image, per-page title and description.
- [ ] 14.22 Areas panel: add towns, toggle, custom intro per town.
- [ ] 14.23 Save draft (autosave with debounce), Publish, Discard draft, "View live".
- [ ] 14.24 Preview device toggle (desktop, tablet, phone widths).
- [ ] 14.25 Publish validation: required hero heading, at least one enabled page, contrast passes; errors shown inline.
- [ ] 14.26 Reviews manager `/studio/website/reviews`: add, edit, publish, order.
- [ ] 14.27 Site analytics tab: views per page per day, top areas, contact form submissions.

Domains
- [ ] 14.28 `/studio/settings/domain`: enter domain, instructions (CNAME to platform host or A records), "Add to Vercel" when API token configured, verify button, status badge, HTTPS note.
- [ ] 14.29 Custom domain verification job (Vercel Domains API `verified` flag) in cron; proxy cache invalidation.
- [ ] 14.30 Remove domain.

SEO and quality
- [ ] 14.31 Per-tenant `sitemap.xml` and `robots.txt` (galleries and hub excluded).
- [ ] 14.32 LocalBusiness JSON-LD from business details; Person JSON-LD on About.
- [ ] 14.33 OG image generated per tenant (logo, name, colors).
- [ ] 14.34 Redirect `www.` to apex for custom domains (or the reverse, per studio choice).
- [ ] 14.35 Tests: section schema validation, publish validation, nav order, area slug generation.
- [ ] 14.36 Visual check of both templates at 375, 768, 1280 px recorded as screenshots in `docs/screenshots/`.

## Phase 15. Portfolio and asset library

- [ ] 15.1 `/studio/assets`: upload many, grid with thumbnails, search by filename and tag, filter by kind (portfolio, site, logo, reference), sort.
  - [ ] 15.1.1 Multi-upload with progress
  - [ ] 15.1.2 Grid with thumbnails
  - [ ] 15.1.3 Search by filename and tag
  - [ ] 15.1.4 Filter by kind
  - [ ] 15.1.5 Sort by date, name, size
- [ ] 15.2 Asset detail drawer: alt text, tags, dimensions, size, where used (site sections, portfolio, mood boards), replace file, delete (blocked when in use, with the list of uses).
- [ ] 15.3 Bulk tag and bulk delete.
- [ ] 15.4 Variants generated on upload (thumb 480, web 1600, original kept); public store for site use.
- [ ] 15.5 `/studio/portfolio`: pick assets, order (drag), categories (create, rename), captions, featured flag, publish toggle.
- [ ] 15.6 Import from gallery: pick a finished gallery, select photos, copy into assets as portfolio items; requires the client consent checkbox recorded on the order.
- [ ] 15.7 Storage accounting includes assets and documents; usage shown on billing and assets pages.
- [ ] 15.8 Orphan cleanup job: blobs without rows older than 7 days are deleted (cron, logged).
- [ ] 15.9 Tests: usage count maintenance, delete blocked when in use.

## Phase 16. Emails, automations, sending domains

Templates and sending
- [ ] 16.1 `/studio/emails`: templates list with key, subject, last edited, "reset to default".
- [ ] 16.2 Template editor: subject, body (plain text with variables, light formatting), variables list with insert buttons, live preview with sample data, test send to me.
  - [ ] 16.2.1 Subject field with variables
  - [ ] 16.2.2 Body editor with variables and insert buttons
  - [ ] 16.2.3 Live preview with sample data
  - [ ] 16.2.4 Test send to me
  - [ ] 16.2.5 Reset to default
- [ ] 16.3 Sender identity settings: display name, from local part, reply-to, signature block.
- [ ] 16.4 Email log `/studio/emails/log`: filters by status and template, search by recipient, detail with rendered body, resend.
- [ ] 16.5 Resend webhook `POST /api/resend/webhook`: verify signature, map `email.delivered|opened|clicked|bounced|complained` to `email_log`, add suppressions on hard bounce and complaint, `domain.updated` to `sending_domains`.
- [ ] 16.6 Suppression list page with manual add and remove.

Automations
- [ ] 16.7 `/studio/emails/automations`: rules list with toggle and delay: balance reminder (N days before session, and N days after if unpaid), gallery expiring (7 and 1 days), unanswered client note (2 days), thank you (1 day after finals), review request (7 days after finals), session reminder (1 day before).
  - [ ] 16.7.1 Balance reminder rule
  - [ ] 16.7.2 Gallery expiring rule
  - [ ] 16.7.3 Unanswered note rule
  - [ ] 16.7.4 Thank you rule
  - [ ] 16.7.5 Review request rule
  - [ ] 16.7.6 Session reminder rule
- [ ] 16.8 Cron `daily` runs automations idempotently via `automation_sends`.
- [ ] 16.9 Automation log visible per client in the timeline.
- [ ] 16.10 Pause all automations switch (for vacations).

Sending domains
- [ ] 16.11 `/studio/settings/email-domain`: explain why a subdomain, input (`mail.` prefilled), "Add domain" → Resend create; stores id and records.
  - [ ] 16.11.1 Explanation copy and subdomain input
  - [ ] 16.11.2 Add domain action → Resend create
  - [ ] 16.11.3 Records stored and shown
- [ ] 16.12 DNS table: host, type, value, copy buttons, per-record status once Resend reports it.
- [ ] 16.13 "Check now" → Resend verify; status badge (pending, verified, failed, temporary failure) with Resend's status text.
- [ ] 16.14 Cron re-check of pending domains every 15 minutes for 72 hours, then daily; email owner on verified or failed.
- [ ] 16.15 Verified switch: `senderFor(studio)` uses the domain; test send button.
- [ ] 16.16 DMARC helper: suggested `v=DMARC1; p=none; rua=mailto:...` with explanation; marked optional.
- [ ] 16.17 Remove domain: delete in Resend, fall back to platform sender.
- [ ] 16.18 Platform admin: domains used vs Resend plan limit with a warning at 80%.
- [ ] 16.19 Tests: status mapping, sender selection, suppression enforcement, automation idempotency.
- [ ] 16.20 `docs/SETUP.md`: Resend account, API key, platform domain verification, webhook, plan size guidance.

## Phase 17. Settings, team, data

- [~] 17.1 `/studio/settings` hub with tabs: Profile, Branding, Website, Domain, Payments, Email domain, Emails, Agreement, Bookings, Team, Lightroom, Referrals, Billing, Data.
- [ ] 17.2 Profile: studio name, legal name, email, phone, address, timezone, currency, business hours.
- [ ] 17.3 Branding: logo (asset), brand color, favicon; used by app emails and tenant pages.
- [ ] 17.4 Team: members with role and last login; invite by email with role; change role; remove; pending invites with resend and revoke; owner transfer.
  - [ ] 17.4.1 Members list with role and last login
  - [ ] 17.4.2 Invite by email with role
  - [ ] 17.4.3 Change role
  - [ ] 17.4.4 Remove member
  - [ ] 17.4.5 Pending invites: resend, revoke
  - [ ] 17.4.6 Owner transfer
- [ ] 17.5 Per-user notification settings: new inquiry, new note, payment received, booking made, daily digest.
- [ ] 17.6 Lightroom tab: tokens list (name, created, last used), create (shown once), revoke, plugin download, install guide.
- [ ] 17.7 Data tab: export everything (JSON + CSV zip, emailed when ready), import (link to Phase 21), delete studio (type name to confirm; cancels subscription, disconnects Stripe, schedules purge).
- [ ] 17.8 Audit log viewer with filters (user, action, date).
- [ ] 17.9 Tests: role checks on every settings action (member cannot invite; admin cannot delete studio).

## Phase 18. Lightroom API and plugin

API
- [ ] 18.1 `withApi()` wrapper: bearer token → studio, JSON errors with codes, per-token rate limit, revoked and read-only checks, `last_used_at`.
- [ ] 18.2 `GET /api/lr/ping` (studio name, plugin min version).
- [ ] 18.3 `GET /api/lr/clients?q=` and `POST /api/lr/clients`.
- [ ] 18.4 `GET /api/lr/galleries?client=` and `POST /api/lr/galleries` (kind, title, client).
- [ ] 18.5 `POST /api/lr/photos/begin` (filename, size, sha256) → upload URL and photo id; duplicate detection returns existing id.
- [ ] 18.6 `POST /api/lr/photos/complete` → variants, usage.
- [ ] 18.7 `DELETE /api/lr/photos/[id]` and `PATCH` for replace (republish keeps id and order).
- [ ] 18.8 `GET /api/lr/galleries/[id]/feedback` → favorites and comments since a timestamp.
- [ ] 18.9 `POST /api/lr/galleries/[id]/publish` and `/unpublish`.
- [ ] 18.10 API versioning header and a changelog section.
- [ ] 18.11 Tests: token auth, rate limit, ownership on every route.

Plugin
- [ ] 18.12 Rename plugin files and ids to the placeholder; config reads site URL stamped by the zip script.
- [ ] 18.13 Publish service: create collection → gallery mapping, choose client and kind, upload with progress, retries.
  - [ ] 18.13.1 Collection to gallery mapping dialog
  - [ ] 18.13.2 Client picker (search, create)
  - [ ] 18.13.3 Kind picker (proofs, finals)
  - [ ] 18.13.4 Upload loop with begin/complete
  - [ ] 18.13.5 Progress and summary
- [ ] 18.14 Republish changed photos in place; delete removed ones.
- [ ] 18.15 Sync favorites: flag or color label, and comments into the photo's metadata field; configurable.
  - [ ] 18.15.1 Favorites → flag or color label (setting)
  - [ ] 18.15.2 Comments → metadata field
  - [ ] 18.15.3 Sync on demand and on publish
- [ ] 18.16 Keyword tagging of published photos with gallery name.
- [ ] 18.17 "Open gallery in browser" and "Open studio" menu items.
- [ ] 18.18 Token entry dialog with validation against `ping`.
- [ ] 18.19 Error dialogs with plain-language messages and a log file location.
- [ ] 18.20 Plugin version check against the API's minimum; update prompt.
- [ ] 18.21 Manual test script in `docs/LIGHTROOM-TESTING.md` (publish, republish, delete, feedback) run on Lightroom Classic current version before release.
- [ ] 18.22 Download route `/api/plugin/download` (requires login), version shown in settings.

## Phase 19. Platform admin (`/admin`)

- [ ] 19.1 Guard and layout (platform admin flag), separate nav.
- [ ] 19.2 Studios list: name, slug, owner, state, trial end, storage, members, Stripe connected, sending domain, created, last activity; search and filters.
- [ ] 19.3 Studio detail: read-only view of settings and counts; actions suspend, unsuspend, extend trial, comp, force read-only, schedule purge, cancel purge.
  - [ ] 19.3.1 Suspend
  - [ ] 19.3.2 Unsuspend
  - [ ] 19.3.3 Extend trial
  - [ ] 19.3.4 Comp
  - [ ] 19.3.5 Force read-only
  - [ ] 19.3.6 Schedule purge
  - [ ] 19.3.7 Cancel purge
- [ ] 19.4 Impersonation (read-only) link into the studio with a red banner and audit entry.
- [ ] 19.5 Metrics: studios by state, trials converting, MRR, signups per week, storage total, galleries live, emails sent, referral rewards granted.
  - [ ] 19.5.1 Studios by state
  - [ ] 19.5.2 Trial conversion rate
  - [ ] 19.5.3 MRR
  - [ ] 19.5.4 Signups per week
  - [ ] 19.5.5 Storage total and top 10
  - [ ] 19.5.6 Galleries live
  - [ ] 19.5.7 Emails sent and failure rate
  - [ ] 19.5.8 Referral rewards granted
- [ ] 19.6 Leads list with mark contacted.
- [ ] 19.7 Email log across studios with failure rate and bounce rate.
- [ ] 19.8 Referrals list with void and re-grant.
- [ ] 19.9 Platform settings: signups open, maintenance banner text, minimum plugin version.
- [x] 19.10 `GET /api/health`: db, blob, stripe, resend reachability (cached 60 s).
- [ ] 19.11 Daily platform digest email to `PLATFORM_ALERT_EMAIL`: signups, conversions, failures, storage outliers.
- [ ] 19.12 Tests: admin guard, suspend blocks studio writes.

## Phase 20. Referral program

- [ ] 20.1 `/studio/referrals`: your link (`APP_URL/signup?ref=CODE`), copy button, prewritten email and text message, stats (invited, signed up, rewarded), list with status.
- [ ] 20.2 "Invite by email" form: sends a referral email with the link from the studio's sender.
- [ ] 20.3 Signup capture (5.4, 5.5).
- [ ] 20.4 Reward on referred studio's first paid invoice: apply `referral_10_12mo` coupon to the referred subscription (or at their checkout if pending) and to the referrer's subscription.
- [ ] 20.5 Queue when a discount is already active; cron applies from `reward_queue` when the current discount ends.
- [ ] 20.6 Referrer on trial with no subscription: reward stored as pending and applied at their checkout.
- [ ] 20.7 Fraud rules enforced (3.85) with reasons stored on void.
- [ ] 20.8 Void on refund or dispute of the referred studio's first invoice within 30 days; remove discount going forward.
- [ ] 20.9 Emails: "Your friend joined", "Your 10% for 12 months is on", "Your reward is queued".
- [~] 20.10 `/referrals` public terms page; pricing page mention; onboarding checklist item.
- [ ] 20.11 Platform admin views (19.8).
- [ ] 20.12 Tests: reward path, queue path, void path, cap.

## Phase 21. Import, booking, session planning

Import
- [ ] 21.1 `/studio/import`: choose source (Pixieset, Pic-Time, ShootProof, plain zip), instructions for exporting from that tool, upload zips (multi, resumable), optional client CSV.
- [ ] 21.2 Scan step: list of detected galleries (from folder names) with photo counts; edit titles; assign or create clients; choose kind and status (draft by default).
  - [ ] 21.2.1 Detected galleries list from folders
  - [ ] 21.2.2 Edit titles and kinds
  - [ ] 21.2.3 Assign or create clients
  - [ ] 21.2.4 Choose status (draft default)
- [ ] 21.3 Run step: background processing in cron `frequent` (chunks), progress bar, per-file errors.
- [ ] 21.4 Finish: summary, "open galleries", email `import_finished`.
- [ ] 21.5 Duplicate handling by sha256 within a gallery.
- [ ] 21.6 Import log retained 30 days; zips deleted after success.
- [ ] 21.7 Docs page per source with the exact export steps as verified against each vendor's help pages (mark unverified where not confirmed).
- [ ] 21.8 Tests: folder mapping, CSV attach, resume after failure.

Booking
- [ ] 21.9 `/studio/settings/bookings`: enable, weekly hours grid, buffer minutes, lead time, max per day, packages bookable, deposit required to confirm, cancellation policy text.
  - [ ] 21.9.1 Enable switch
  - [ ] 21.9.2 Weekly hours grid
  - [ ] 21.9.3 Buffer and lead time
  - [ ] 21.9.4 Max per day
  - [ ] 21.9.5 Bookable packages and deposit rule
  - [ ] 21.9.6 Cancellation policy text
- [ ] 21.10 Tenant `/book`: pick package, pick date (calendar with available days), pick time, enter details, agree to policy, hold slot, pay deposit (Checkout on the studio's account) or confirm without payment when not required.
  - [ ] 21.10.1 Pick package
  - [ ] 21.10.2 Calendar with available days
  - [ ] 21.10.3 Time slots for the day
  - [ ] 21.10.4 Details form
  - [ ] 21.10.5 Policy agreement
  - [ ] 21.10.6 Hold slot
  - [ ] 21.10.7 Deposit Checkout or confirm
- [ ] 21.11 Hold expiry (15 minutes) and release.
- [ ] 21.12 Confirmation creates client (or links), order, booking slot, session; emails `booking_confirmed` to client and notice to studio; calendar shows it.
- [ ] 21.13 Reschedule and cancel links in the client hub within policy; studio can override.
- [ ] 21.14 Booking reminders (automation) and no-show marking.
- [ ] 21.15 Blocked dates (holidays) and one-off overrides.
- [ ] 21.16 Tests: availability math, hold race (two clients same slot), policy enforcement.

Session planning
- [ ] 21.17 Session plan card on the session page: notes (Markdown), shot list (checklist with add, reorder, check), mood board (asset picker plus upload), "share with client" toggle.
  - [ ] 21.17.1 Notes (Markdown)
  - [ ] 21.17.2 Shot list checklist
  - [ ] 21.17.3 Mood board picker and upload
  - [ ] 21.17.4 Share with client toggle
- [ ] 21.18 Client view of the plan in the hub and via emailed link (`session_plan_shared`).
- [ ] 21.19 Templates for shot lists (headshot, team day, actor) to insert.
- [ ] 21.20 Print view of the plan.
- [ ] 21.21 Tests: client visibility flag, asset references.

## Phase 22. Quality, security, launch

Tests and checks
- [ ] 22.1 Unit test coverage report in CI; threshold 80% for `lib/`.
- [ ] 22.2 Route tests for every API route: auth required, tenant scoping, method not allowed.
- [ ] 22.3 Playwright smoke: signup → onboarding → create client → create gallery → upload → publish → open as client → favorite → pay (test mode) → see paid.
  - [ ] 22.3.1 Signup and verify
  - [ ] 22.3.2 Onboarding wizard
  - [ ] 22.3.3 Create client
  - [ ] 22.3.4 Create gallery
  - [ ] 22.3.5 Upload photos
  - [ ] 22.3.6 Publish and send
  - [ ] 22.3.7 Open as client with code
  - [ ] 22.3.8 Favorite and note
  - [ ] 22.3.9 Pay deposit in test mode
  - [ ] 22.3.10 Paid state reflected in studio
- [ ] 22.4 Playwright: website editor publish and view; template switch keeps content.
- [ ] 22.5 Playwright: Lightroom API flow with a fake plugin client.
- [ ] 22.6 `typecheck`, `lint`, `test`, `build` green in CI on every push.

Security
- [ ] 22.7 Security review of every Server Action and route for tenant scoping (`assertOwned`) with a checklist file listing each.
  - [ ] 22.7.1 Auth and account actions
  - [ ] 22.7.2 Clients and inquiries
  - [ ] 22.7.3 Sessions, packages, payments
  - [ ] 22.7.4 Galleries and photos
  - [ ] 22.7.5 Website and assets
  - [ ] 22.7.6 Emails and sending domains
  - [ ] 22.7.7 Billing and Stripe connection
  - [ ] 22.7.8 Lightroom API
  - [ ] 22.7.9 Referrals
  - [ ] 22.7.10 Platform admin
- [ ] 22.8 CSRF: Server Actions origin check confirmed for tenant hosts; API routes require bearer or same-origin.
- [ ] 22.9 Secrets never logged; log redaction test.
- [ ] 22.10 Upload validation: content sniffing, size caps, filename sanitization, no SVG in galleries.
- [ ] 22.11 Rate limits verified with a script.
- [ ] 22.12 Dependency audit (`npm audit`) clean or documented.
- [ ] 22.13 Headers verified with a scanner (HSTS, CSP report-only first, then enforce).
- [ ] 22.14 Backups: Neon point-in-time restore tested once; Blob export script.

Performance
- [ ] 22.15 Gallery page: images lazy, thumbs sized, p95 photo route under 300 ms from cache.
- [ ] 22.16 Database: `EXPLAIN` on the ten heaviest queries; indexes adjusted.
- [ ] 22.17 Bundle size check on tenant pages (no studio code shipped to clients).

Docs and launch
- [ ] 22.18 `docs/SETUP.md` complete and followed once from scratch on a fresh Vercel project.
- [ ] 22.19 `docs/ARCHITECTURE.md` complete.
- [ ] 22.20 `docs/LAUNCH-CHECKLIST.md`: legal pages reviewed, Stripe live keys, Connect platform profile approved for live, webhooks live, Resend production domain, DNS, backups, monitoring, support email, status page.
  - [ ] 22.20.1 Legal pages reviewed
  - [ ] 22.20.2 Stripe live keys and price
  - [ ] 22.20.3 Connect platform profile complete in live mode
  - [ ] 22.20.4 Webhooks live and tested
  - [ ] 22.20.5 Resend production domain verified
  - [ ] 22.20.6 DNS and wildcard
  - [ ] 22.20.7 Backups verified
  - [ ] 22.20.8 Monitoring and alert email
  - [ ] 22.20.9 Support email and hours
  - [ ] 22.20.10 Status page link
- [ ] 22.21 Real screenshots for marketing pages.
- [ ] 22.22 Accessibility audit (gallery, pay, website templates) with fixes.
- [ ] 22.23 Test studio created on production for the owner; end-to-end run with a real $1 payment in the owner's own Stripe account, then refunded there.
- [ ] 22.24 Rename pass (1.30) executed once the name is chosen.
- [ ] 22.25 Version 1.0 tag and CHANGELOG entry.

## Removed (by decision)

- [-] Tiered plans, feature gating, storage caps, seat limits.
- [-] Platform fee on client payments, refunds or disputes handled by the platform, Express or Custom accounts.
- [-] Page builder with arbitrary blocks and custom HTML.
- [-] Two-factor auth, SSO, outbound webhooks, blog posts, print lab.

## Deferred

- [-] Native mobile apps.
- [-] Yearly pricing (add when pricing is revisited).

---

## Appendix A. Registering as a Stripe Connect platform (what you do in the Stripe Dashboard)

Everything below is from Stripe's documentation as read on September 9, 2026. Do it in test mode (a sandbox) first, then again in live mode before launch.

1. **Log in to your Stripe account** (the one that will receive the $40 subscriptions). This same account becomes the "platform".
2. **Complete the platform profile.** Go to `https://dashboard.stripe.com/settings/connect/platform-profile`. Stripe asks how you will use Connect. Answer for our design: your users (studios) collect payments from their own customers; charges are created directly on the connected accounts (direct charges); connected accounts have full Stripe Dashboard access; Stripe is responsible for negative balances and for collecting requirements; you will not take application fees. Stripe's docs: "Before starting your integration in a sandbox environment, you must create a Stripe Account or log in and onboard your platform to Connect."
3. **Set Connect branding.** In Connect settings, add the business name, brand color and icon. Stripe: "Connect Onboarding requires this information." It appears on the hosted onboarding form and on the OAuth screen.
4. **Turn on OAuth and add redirect URIs.** Go to `https://dashboard.stripe.com/settings/connect/onboarding-options/oauth`. Copy the `client_id` (starts with `ca_`; test and live have different ids) into `STRIPE_CONNECT_CLIENT_ID`. Add the redirect URI `https://APP_DOMAIN/api/connect/oauth/callback` (Stripe: "the live mode redirect_uri must use a secure HTTPS connection"). For local testing add `http://localhost:3000/api/connect/oauth/callback` in test mode.
5. **Create the two webhook endpoints.** In Workbench → Webhooks (`https://dashboard.stripe.com/workbench/webhooks`): (a) an endpoint for **Your account** events at `https://APP_DOMAIN/api/stripe/webhook` listening to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`; (b) an endpoint with **Events from: Connected accounts** at `https://APP_DOMAIN/api/stripe/connect-webhook` listening to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `account.updated`, `account.application.deauthorized`. Copy each signing secret into `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET`. Item 1.16 can create these by API instead.
6. **Create the product and price** by running `npm run stripe:setup` with your secret key, or by hand: product "Studio", recurring price $40.00 USD monthly, lookup key `studio_monthly`. Paste the price id into `STRIPE_PRICE_STUDIO_MONTHLY`. The same script creates the referral coupon.
7. **Configure the Customer Portal** at `https://dashboard.stripe.com/settings/billing/portal`: allow customers to update payment methods and cancel subscriptions; do not allow plan switching.
8. **Go live.** Repeat steps 3 to 7 in live mode, with the live `client_id`, live webhook secrets and live price id in the production environment variables. Stripe may ask for additional business information in the platform profile before enabling live connected accounts; the Dashboard shows any outstanding items.

What studios see: a Stripe-hosted page that says your app wants to connect to their Stripe account (OAuth), or a Stripe-hosted form to create a new account (Account Link). After that, every client payment goes to their Stripe balance and their payout schedule, and their own Dashboard shows the charges.
