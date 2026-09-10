# Architecture

Short descriptions of how the pieces fit.

## Tenancy and host routing

- The tenant is a row in `studios`. Every domain table carries `studio_id`, and every query that reads or writes tenant data goes through `assertOwned` or a studio-scoped query.
- `src/proxy.ts` classifies the request host (`src/lib/tenant.ts`): the root domain serves marketing, auth, the studio app and platform admin; `{slug}.APP_DOMAIN` and verified custom domains are rewritten to `/t/{slug}/...`; the path form also works on the root host and on preview deployments.
- Custom domain to slug lookups are cached in memory for 60 seconds.

## Auth and sessions

- Passwords: scrypt (`src/lib/password.ts`). Sessions: rows in `sessions` with a hashed token in an httpOnly cookie, 30 days rolling (`src/lib/session.ts`).
- One-time tokens (`auth_tokens`) for email verification, password reset and invitations, always stored hashed.
- Rate limits are fixed windows in Postgres (`rate_limits`); login lockout after repeated failures.
- Roles: owner, admin, member per membership. Platform admins are a flag on `users`.
- `src/lib/auth.ts` is the data access layer every page and action calls first.

## Billing state

- One plan. `src/lib/plans.ts` exports `PLAN` and `billingState(studio)`, which derives `trialing | active | past_due | read_only | locked` from the studio row. `canWrite` gates mutations; `publicLive` gates galleries and the website.
- The platform's only money is the $40/month subscription (Phase 6).

## Client payments

- Each studio connects its **own** Stripe account (OAuth for existing accounts, hosted onboarding / Account Links for new ones; `src/lib/connect.ts`). `canTakeCardPayments(studio)` gates checkout on `charges_enabled`.
- Charges are **direct charges** on the connected account via the `Stripe-Account` header (`onAccount`) with **no application fee** — the client's money never touches the platform. `createOrderCheckout` builds a Checkout Session for a deposit, balance or full amount and records a pending `payments` row; `amountForKind` + `orderMoney` compute what's due from the order and prior payments.
- The connected-accounts webhook (`/api/stripe/webhook`, signature-verified, idempotent via `stripe_events`) mirrors `checkout.session.completed` → paid, `charge.refunded` → refund state, `charge.dispute.created` → dispute state, and re-syncs the order (`syncOrderPaymentState`). Refunds and disputes are handled by the studio in its own dashboard; a reversed first invoice voids a referral reward.
- The platform's only charge is the $40/month subscription on the platform account (Phase 6), separate from client payments.

## Storage and images

- Vercel Blob, two stores (`src/lib/storage.ts`): **galleries** (private) for originals, previews and thumbnails; **assets** (public) for site images and logos. `blobToken(store)` selects the read/write token.
- Browser uploads go **direct to Blob**: the server issues a short-lived client token bound to one pathname, a size cap and an allow-list of content types (`clientUploadToken`); the shared `Uploader` puts the bytes and reports completion, and the server then generates variants.
- Images are processed with sharp (`src/lib/images.ts`): a ~1600px web preview and a ~480px thumbnail, EXIF capture time, and a sha256 for per-gallery dedup. Private originals and previews are streamed through signed app routes with ETag/304 and a pay-gate check; full-size is gated until paid.

## Email and sending domains

- Resend over its HTTP API (`src/lib/email.ts`); without `RESEND_API_KEY` every send is a logged no-op so the UI can fall back to copyable links. Every attempt is written to `email_log`.
- Platform mail (login, billing) leaves from the platform domain. Studio mail leaves from the studio's **own** verified subdomain when present (`sending_domains`), else from the platform domain as "Studio via App" with the studio's address as reply-to (`senderFor`/`sendStudioEmail`).
- Templates are per-studio overrides of built-in defaults (`email-templates.ts` + `email-templates-server.ts`); automations claim each due target in `automation_sends` so a rule fires at most once. The Resend webhook (`/api/resend/webhook`, Svix-signed) mirrors delivery events and suppresses hard bounces and complaints.

## Lightroom API and plugin

- A bearer-token API under `/api/lr/**`; `withApi` maps a token (`api_tokens`) to one studio, rate-limits 120/min per token, blocks writes for read-only tokens, and returns JSON errors with an `X-LR-Api-Version` header.
- The Lightroom Classic publish plugin (`lightroom/`) uploads photos (begin → PUT bytes → ingest, with sha256 dedup), republishes in place, deletes, and pulls favorites and comments back into Lightroom's ratings and Comments panel. It is served login-gated from `/api/plugin/download`, zipped on the fly with the studio's site URL stamped in.

## Booking, imports and planning

- **Booking:** availability is pure slot math (`booking-shared.ts`) over weekly hours, buffers, lead time, blocked dates and one-off overrides, DST-correct via `Intl`. A public `/book` flow holds a slot (a Postgres exclusion constraint prevents double-booking), creates the client, order and confirmed slot, and optionally sends the client to a deposit Checkout. Clients reschedule/cancel from the portal within a policy window; the frequent cron releases expired holds.
- **Imports:** zip exports upload to Blob and are scanned by streaming (`fflate`, no zip held in memory) into proposed galleries by folder; after a review/mapping step the frequent cron processes photos in chunks (idempotent via a per-gallery `done` list), dedupes by sha256, and emails `import_finished`. A CSV path creates clients matched by email.
- **Session planning:** `session_plans` holds Markdown notes, a shot list, and mood-board asset references per order, with a client-visibility flag; shared plans appear in the client portal and print from a chrome-free page.

## Observability

- Structured JSON logging (`src/lib/logger.ts`) for the log drain; every payload passes through `redact()` so secrets never reach logs.
- Two cron endpoints (`/api/cron/{frequent,daily}`) run holds release, domain re-checks, import chunks, automations, orphan-blob cleanup and the platform digest.

## Tables

Identity and tenancy: `users` (people who log in), `studios` (the tenant, with billing, Stripe connection, referral code and the template website in `site`/`site_draft`), `memberships` (user to studio with role), `invitations`, `sessions` (login sessions, hashed token), `auth_tokens` (one-time, hashed), `rate_limits`, `audit_log`, `api_tokens` (Lightroom), `stripe_events` (webhook idempotency), `platform_settings`.

CRM: `clients` (with `stage`, tags, unsubscribe, last activity), `inquiries` (contact form), `booking_requests`, `tasks`, `client_notes` (written by people), `client_events` (system timeline), `leads` (platform contact form).

Sales: `packages`, `orders` (a session; numbered per studio; agreement signature fields), `payments` (mirrors of charges on the studio's Stripe account, with refund and dispute state), `documents`, `agreement_templates` (versioned per studio).

Galleries: `galleries` (proof or final, team-day children via `parent_id`, access and download options), `photos` (originals private, previews public, soft delete, sha256), `photo_comments`, `photo_selections` (favorites), `gallery_visits`, `gallery_downloads`.

Website, portfolio, assets: `assets` (every uploaded image, usage count), `portfolio_items`, `reviews`, `site_areas` (local landing pages), `analytics_daily`.

Email: `email_templates`, `email_log` (with delivery events), `automation_sends` (one send per rule and target), `sending_domains` (the studio's Resend domain), `suppressions`, `broadcasts`.

Referrals, imports, booking, planning: `referrals`, `reward_queue`, `imports`, `import_files`, `booking_slots` (exclusion constraint prevents overlaps), `session_plans`.

All `updated_at` columns are maintained by the `set_updated_at` trigger.
