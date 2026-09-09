# Build plan (revision 3, September 9, 2026)

A multi-tenant platform for photographers. Each studio gets: a public website built from one of two templates (home, portfolio, pricing, about, contact, open-your-gallery, optional local area pages), branded client galleries with proofing, deposits and e-signed agreements paid into the studio's **own** Stripe account, a CRM (inbox, clients, sessions, tasks), an asset library, email templates and automations sent from the studio's **own** domain, team seats, a referral program, and a two-way Lightroom Classic plugin. Built as a separate app in `saas/`, deployed to its own Vercel project and domain.

Working name in code: `NEXT_PUBLIC_APP_NAME` (currently "Proofroom", to be replaced; see Decision 0.15). The name appears in one env var, the plugin id, and the token prefix.

Legend: `[ ]` not started, `[x]` done, `[~]` in progress, `[-]` removed or deferred (reason noted), `[?]` proposed, needs approval. Every item is one small, verifiable piece with a file or behaviour to check.

**Status: paused. Nothing beyond the foundation (Phases 1 to 5, partial 8) gets built until this plan is approved.**

---

## What changed in revision 3 (from feedback on September 9)

1. **Tenant website is two templates, not a page builder.** Studios pick a template, upload background images, edit text, show or hide sections, and change colors. No block editor, no drag-and-drop, no custom HTML.
2. **Zero involvement in client payments.** No platform fee, no funds through the platform, no refund or dispute handling by the platform. The studio connects its own Stripe account; charges are created directly on that account; Stripe bills the studio its own fees; disputes and refunds are the studio's, handled in the studio's own Stripe Dashboard. The platform only reads payment status to mark orders paid. Details and the Stripe wording that supports this are in Decision 0.8.
3. **Referral program added** (Phase 20): both the referrer and the referred studio get one month free (monthly plans) or 10% off the year (yearly plans) when the referred studio's first paid invoice succeeds.
4. **Per-studio sending domains moved into scope** (Phase 15).
5. **Removed from the plan entirely:** two-factor auth, SSO, outbound webhooks, blog posts. **Still deferred:** native apps.
6. **Proposed additions from the outside analysis** (Phase 21, marked `[?]`): migration import from other gallery tools, a simple booking page, and session planning (notes, shot list, mood board).
7. **Name change required.** proofroom.com is held at $5,000. Candidate names checked on September 9 are listed in Decision 0.15.

---

## Phase 0. Decisions

- [x] 0.1 App in `saas/`, own `package.json`, separate Vercel project (Root Directory `saas`).
- [x] 0.2 Next.js 16.3.4 App Router, React 19, TypeScript strict, Tailwind 4. Cache Components off.
- [x] 0.3 Neon Postgres via serverless HTTP driver, plain SQL, bound parameters, idempotent schema applied on every build.
- [x] 0.4 Tenant = `studios`; every domain table has `studio_id`; users join via `memberships` (owner, admin, member).
- [x] 0.5 Tenant hosts `{slug}.APP_DOMAIN` and verified custom domains rewrite to `/t/{slug}/...`, which also works on the root host and previews.
- [x] 0.6 Auth: scrypt passwords, DB sessions in httpOnly cookie, hashed one-time tokens, Postgres rate limits, lockout. No 2FA, no SSO (removed by decision).
- [x] 0.7 Platform billing: Stripe subscriptions (Checkout, Customer Portal, webhooks). Free, Starter $12, Pro $24, Studio $49 per month (yearly $10/$20/$40 per month). 14-day Pro trial. This is the only money the platform ever touches.
- [ ] 0.8 **Client payments: the studio's own Stripe account, direct charges, no application fee, no platform liability.** Revised from Express to the Standard-equivalent configuration. Stripe's own documentation on why this matches "we have nothing to do with their payments":
  - Account type table (docs.stripe.com/connect/accounts): Standard, "Fraud and dispute liability: Connected account for direct charges"; "Connected account access to the Stripe Dashboard: Full Dashboard"; "Onboarding: Stripe"; "Identity information gathering: Stripe"; "There's an additional cost for using Express or Custom connected accounts" (none listed for Standard).
  - Controller properties for the Standard-equivalent account (docs.stripe.com/connect/migrate-to-controller-properties): `losses.payments = stripe` ("Stripe is liable when this account can't pay back negative balances"), `fees.payer = account` ("The connected account pays all Stripe fees directly to Stripe, inclusive of payment processing fees"), `requirement_collection = stripe`, `stripe_dashboard.type = full`. These are the API defaults: "If you create an account without specifying any controller properties, the default values match the behavior of a Standard account."
  - Direct charges (docs.stripe.com/connect/direct-charges): "The payment appears as a charge on the connected account, not your platform's account." "This charge type is best suited for platforms providing software as a service." The application fee is an optional parameter; we never send one. Checkout "uses the brand settings of the connected account", so the client sees the studio's name, not ours.
  - Stripe also says: "We recommend using direct charges for connected accounts that have access to the full Stripe Dashboard."
  - How the studio connects: Connect Onboarding for Standard accounts (Account Links). Stripe hosts the form, collects identity, and the studio signs Stripe's agreement directly. For studios that already have a Stripe account, Stripe's OAuth flow ("The process of creating a Stripe account is incorporated into our authorization flow. You don't need to worry about whether or not your users already have accounts") connects the existing account; Stripe notes OAuth "isn't recommended for new Connect platforms" but still supports it, and Accounts v2 does not support OAuth at all. **Decision to confirm:** offer both buttons, "Connect existing Stripe account" (OAuth) and "Create a Stripe account" (Account Link), both landing on a Standard-equivalent account.
  - Stripe still calls us a "platform" and requires a Connect platform profile, because the pay page is served by us. That is unavoidable if the client pays inside the gallery. What we do **not** do: hold funds, take a fee, set payout timing, issue refunds, respond to disputes, or collect identity documents. Refunds and disputes happen in the studio's Stripe Dashboard; we learn about them from webhooks and update the order.
  - Code changes this implies: delete `PLATFORM_FEE_BPS` from `.env.example` and `stripe.ts`; create accounts with no `type` and no controller overrides; add OAuth `client_id` env; keep `STRIPE_CONNECT_WEBHOOK_SECRET` for reading `checkout.session.completed`, `charge.refunded`, `charge.dispute.created`, `account.application.deauthorized`.
  - Alternative considered and not recommended: no Stripe integration at all, the studio pastes a Stripe Payment Link and marks orders paid by hand. Zero platform footprint, but no automatic paid status, no deposit gating of downloads, no receipts. Available as a fallback setting if a studio refuses to connect.
- [x] 0.9 Storage: Vercel Blob private (photos, documents) and public (site images, logos). Usage metered per studio.
- [ ] 0.10 Email: Resend. Default sender is the platform domain with the studio name as display name and the studio's reply-to. **Studios on Pro and Studio plans can verify their own sending domain** and all client email then leaves from it (Phase 15). Resend facts checked September 9 (resend.com/pricing, docs): Free plan 3 domains, Pro plan 10 domains, Scale plans 1,000 domains, add-on "$20/mo adds 100 domains". Resend recommends "sending your emails from one or more subdomains (e.g., updates.example.com) instead of your root domain to isolate your sending reputation". Domains are created and verified by API (`POST /domains`, `POST /domains/{id}/verify`, `domain.updated` webhook); the create response returns the DNS records (DKIM TXT, SPF as MX plus TXT on the return-path subdomain). DMARC is not required for verification; Resend suggests starting at `v=DMARC1; p=none;`.
- [x] 0.11 Lightroom plugin generalized (plugin id and token prefix follow the final name).
- [x] 0.12 Vercel Pro required for commercial use; documented.
- [ ] 0.13 **Tenant public website: two templates, fixed sections, simple controls.** Templates: "Editorial" (light, serif headings, generous white space, the current studio site's feel) and "Gallery" (dark, full-bleed imagery, sans-serif). Each page has a fixed list of sections. Per section the studio can: edit text (heading, subheading, body, button label), upload or pick a background or feature image, toggle the section on or off, and reorder within a small allowed range (not required). Site-wide: primary color, accent color, light or dark base, logo, favicon, one of three font pairings. Nothing else. No custom HTML.
- [x] 0.14 Asset library: one `assets` table for every uploaded image (portfolio, site sections, logo), referenced by id, with usage counts.
- [ ] 0.15 **Name.** proofroom.com is a $5,000 premium. Checked on GoDaddy on September 9, 2026 (availability only; GoDaddy did not return prices in the API response, so a listed name can still be premium at checkout; trademark search at uspto.gov is still required before buying). Available in **both .com and .ai**: Proofbird, Filmbird, Lightfinch, Framebird, Photolark, Wheatear. Available .com only: Nightjar, Redstart, Twite, Lensfinch, Prooffinch, Shutterwren, Proofwren, Snapwren, Pixbird, Cullbird, Lumenroom, Kestrelstudio, Framefinch. Available .ai only: Shutterbird, Shutterfinch, Lightlark, Proofling, Bluefinch, Brambling, Dunlin, Tintype, Silvergrain, Larkstudio. Taken: bluebird (all), lark.ai, finch.ai, wren.ai, kestrel.ai, heron.ai, magpie.ai, starling.ai, kingfisher.ai, osprey.ai, egret.ai, goldfinch.ai, nightjar.ai, waxwing, linnet, siskin, pipit, goldcrest, firecrest, avocet, whimbrel, halide, loupe, lightwell, brightroom, glint, contactsheet, cull.ai, sable.ai, marigold.ai, proofly.ai. **Recommendation: Proofbird** (proofbird.com and proofbird.ai both open; says what it does, reads as a brand, one syllable per word). Second: Lightfinch. Third: Framebird.
- [ ] 0.16 **Referral program** (Phase 20). Reward: one month free on a monthly plan, or 10% off the yearly price on a yearly plan, for both parties, granted when the referred studio's first paid invoice succeeds (not at signup, to prevent farming). Implemented with Stripe coupons applied to the subscription; no cash payouts.
- [ ] 0.17 Removed from the product (not deferred): two-factor auth, SSO, outbound webhooks, blog posts on tenant sites. Deferred: native mobile apps (responsive web instead).

## Phase 1. Scaffold and tooling

- [x] 1.1 `package.json` scripts: dev, build, start, lint, typecheck, test, db:migrate, stripe:setup, plugin:zip, platform:admin.
- [x] 1.2 `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`.
- [x] 1.3 `next.config.ts`: image patterns, Server Actions allowed origins for wildcard hosts, security headers.
- [x] 1.4 `.env.example` with every variable documented.
- [ ] 1.5 `.env.example` revision: remove `PLATFORM_FEE_BPS`; add `STRIPE_CONNECT_CLIENT_ID` (OAuth), `RESEND_WEBHOOK_SECRET`, `REFERRAL_COUPON_MONTHLY`, `REFERRAL_COUPON_YEARLY`.
- [x] 1.6 `.gitignore`.
- [x] 1.7 `scripts/db-migrate.mjs`.
- [x] 1.8 `scripts/stripe-setup.mjs` (idempotent products and prices by lookup key).
- [ ] 1.9 `scripts/stripe-setup.mjs` also creates the two referral coupons (100% off once; 10% off once, yearly only) by id.
- [x] 1.10 `scripts/make-platform-admin.mjs`.
- [x] 1.11 `scripts/plugin-zip.mjs` stamping the site URL.
- [ ] 1.12 `.github/workflows/saas.yml`: install, typecheck, lint, test, build without secrets.
- [ ] 1.13 `vercel.json` in `saas/` with cron schedule for `/api/cron/daily`.
- [ ] 1.14 Rename pass once the name is chosen: env default, plugin id, token prefix, cookie name, docs.

## Phase 2. Database schema

- [x] 2.1 `users`, `studios`, `memberships`, `invitations`, `sessions`, `auth_tokens`, `rate_limits`, `audit_log`, `api_tokens`, `stripe_events`.
- [x] 2.2 `clients`, `inquiries`, `packages`, `orders`, `payments`.
- [x] 2.3 `galleries` (with `parent_id`, `subject_name`), `photos`, `photo_comments`, `photo_selections`.
- [x] 2.4 `email_templates`, `email_log`, `leads`.
- [x] 2.5 `assets`, `portfolio_items`, `reviews`, `tasks`, `client_notes`, `booking_requests`, `analytics_daily`, `documents`, `automation_sends` (created in the foundation commit).
- [ ] 2.6 Replace `site_pages` (blocks jsonb, draft_blocks) with `site` jsonb on the studio: `{ template, colors, font, sections: { home: {...}, portfolio: {...}, pricing: {...}, about: {...}, contact: {...}, gallery: {...} }, areas: [...] , seo: {...}, nav: {...} }`, plus `site_published_at` and `site_draft` jsonb for preview. Simpler than a page table for two templates.
- [ ] 2.7 `studios.stripe_account_id`, `stripe_account_status` kept; add `stripe_connect_method` (`oauth` | `onboarding` | `none`), `stripe_charges_enabled`, `stripe_details_submitted`, drop `payments.platform_fee_cents`.
- [ ] 2.8 `sending_domains`: studio_id, domain, resend_domain_id, status (`not_started` | `pending` | `verified` | `failed` | `temporary_failure`), records jsonb (from Resend), from_local_part (default `hello`), verified_at, last_checked_at. One active domain per studio.
- [ ] 2.9 `referrals`: referrer_studio_id, code (unique, short), referred_studio_id (nullable until signup), status (`invited` | `signed_up` | `rewarded` | `void`), rewarded_at, referrer_coupon_applied, referred_coupon_applied, invoice_id.
- [ ] 2.10 `studios.referral_code` (unique) generated at studio creation; `studios.referred_by_code` captured at signup.
- [ ] 2.11 `automations` settings in `settings` jsonb: reminders for unpaid balance, gallery expiring, unanswered notes.
- [ ] 2.12 Indexes for every studio-scoped list query; unique constraints per studio.
- [ ] 2.13 Seed defaults in code when a studio is created: three packages, site defaults for the chosen template with starter copy, email templates, referral code.
- [ ] 2.14 `[?]` `imports`: studio_id, source (`pixieset` | `pictime` | `shootproof` | `zip` | `csv`), status, counts, log jsonb (Phase 21).
- [ ] 2.15 `[?]` `booking_slots` and `booking_settings` in `settings` (Phase 21).
- [ ] 2.16 `[?]` `session_plans`: order_id, notes, shot_list jsonb, mood_board asset ids (Phase 21).

## Phase 3. Core libraries

- [x] 3.1 `env.ts` typed env and configured flags.
- [x] 3.2 `db.ts`.
- [x] 3.3 `password.ts` scrypt + strength rules.
- [x] 3.4 `tokens.ts`.
- [x] 3.5 `session.ts` DB sessions.
- [x] 3.6 `auth.ts` DAL: user, studio context, roles, platform admin, ownership assert.
- [x] 3.7 `rate-limit.ts`.
- [x] 3.8 `audit.ts`.
- [x] 3.9 `slug.ts` with reserved list.
- [x] 3.10 `tenant.ts` host classification and URL builders.
- [x] 3.11 `plans.ts` catalog and `entitlements()`.
- [ ] 3.12 `stripe.ts` revision: platform client; `onAccount(accountId)` for direct charges; remove fee helpers; add OAuth authorize URL builder, token exchange, deauthorize.
- [x] 3.13 `storage.ts` two stores, per-studio paths.
- [x] 3.14 `images.ts` previews, logos.
- [ ] 3.15 `email.ts` revision: pick sender per studio (verified sending domain, else platform domain with display name), always set reply-to, log every send.
- [x] 3.16 `emails/account.ts`, `emails/studio.ts`.
- [x] 3.17 `contract.ts` per-studio agreement.
- [x] 3.18 `types.ts` rows and money.
- [x] 3.19 `gallery-access.ts`.
- [x] 3.20 `validation.ts` zod schemas.
- [x] 3.21 `action-state.ts`, `logger.ts`.
- [x] 3.22 `account.ts`: create user+studio, defaults, credentials with lockout, one-time tokens.
- [x] 3.23 `usage.ts`: recompute and cache storage bytes, count active galleries, members.
- [ ] 3.24 `site.ts` rewrite: template registry (two templates), section schemas per page (zod), defaults, theme CSS variables, render helpers. Delete block-editor schemas.
- [ ] 3.25 `assets.ts`: upload pipeline (validate, resize variants, record, usage).
- [x] 3.26 `analytics.ts`: record events (deduped per visitor per day), summaries.
- [ ] 3.27 `domains.ts`: Vercel Domains API add/verify for the website custom domain (optional when token present), DNS instructions.
- [ ] 3.28 `sending-domains.ts`: Resend create/get/verify/delete, record formatting, status mapping, DMARC suggestion text.
- [ ] 3.29 `referrals.ts`: code generation, capture at signup, reward on first paid invoice, coupon application, fraud checks (self-referral, same payment method fingerprint, cap of 12 rewards per year per studio).
- [ ] 3.30 `zip.ts`: streaming zip of gallery originals.
- [ ] 3.31 `csv.ts`: export clients and payments; import clients.
- [x] 3.32 `email-templates.ts`: keys, variables, defaults, rendering with placeholders.

## Phase 4. Routing shell and design system

- [x] 4.1 `proxy.ts` tenant rewrite, noindex, optimistic auth, custom-domain cache.
- [x] 4.2 Root layout, `globals.css` tokens (light app, dark gallery, tenant brand var).
- [x] 4.3 `components/ui` kit: Button, Input, Field, Card, Badge, Table, Stat, Meter, Notice, EmptyState, Logo.
- [x] 4.4 `components/forms`: SubmitButton, FormMessage, ConfirmButton, CopyButton.
- [x] 4.5 `not-found`, `error`, `studio-not-found`.
- [ ] 4.6 `loading.tsx` skeletons for studio and tenant segments.
- [ ] 4.7 Toast provider for action feedback.
- [ ] 4.8 Dialog/drawer component (accessible, Escape closes, focus trap).
- [ ] 4.9 Icons set (inline SVG components).
- [ ] 4.10 Image picker component (from asset library or upload) reused by site editor, portfolio, branding.
- [ ] 4.11 Color picker with contrast warning (text on primary must pass 4.5:1).

## Phase 5. Authentication and accounts

- [x] 5.1 Auth layout.
- [x] 5.2 Actions: signup, login, logout, forgot, reset, resend verification, accept invite, switch studio, create additional studio, slug check.
- [x] 5.3 `/signup` page with live subdomain availability and password guidance.
- [ ] 5.4 `/signup?ref=CODE` captures the referral code into a cookie and shows "Referred by {Studio}: you both get a month free".
- [x] 5.5 `/login` page with next redirect.
- [x] 5.6 `/forgot-password`, `/reset-password` pages.
- [x] 5.7 `/verify-email` route consumes token and redirects with a banner.
- [x] 5.8 `/logout` route.
- [x] 5.9 `/invite/[token]` page (new or existing user).
- [x] 5.10 `/api/slug-check` for the signup form.
- [ ] 5.11 Account page: name, email (re-verify on change), password change (requires current), active sessions with revoke, delete account request.
- [ ] 5.12 Verification banner in studio shell with resend.

## Phase 6. Platform billing and the studio's Stripe connection

- [ ] 6.1 `/studio/billing` page: plan, trial, usage meters, invoices, upgrade, portal, referral credits applied.
- [ ] 6.2 `POST /api/billing/checkout` (applies the referred-studio coupon if a pending referral exists).
- [ ] 6.3 `POST /api/billing/portal`.
- [ ] 6.4 `POST /api/stripe/webhook`: subscription lifecycle with idempotency; on `invoice.paid` for a studio's first paid invoice, trigger referral reward (Phase 20).
- [ ] 6.5 Entitlement checks in gallery create, upload begin, invite member, custom domain, branding, team events, site publish, sending domain.
- [ ] 6.6 Upgrade prompts component (inline, links to billing with reason).
- [ ] 6.7 `GET /api/cron/daily`: trial reminders (3 days, 1 day), downgrade expired trials, expire galleries, payment reminders, digest, sending-domain re-check.
- [ ] 6.8 `/studio/settings/payments`: two buttons, "Connect existing Stripe account" (OAuth) and "Create a Stripe account" (Account Link, Standard-equivalent). Plain-language box: "Payments go straight to your Stripe account. We never hold your money, never take a cut, and refunds and disputes are handled in your own Stripe Dashboard."
- [ ] 6.9 `GET /api/connect/oauth/start` builds the authorize URL with `state`; `GET /api/connect/oauth/callback` verifies `state`, exchanges the code, stores `stripe_user_id`.
- [ ] 6.10 `POST /api/connect/onboard` creates an account with default controller properties and an Account Link; return and refresh handlers; status read from `charges_enabled` and `details_submitted`.
- [ ] 6.11 `POST /api/stripe/connect-webhook`: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`, `charge.dispute.created`, `account.updated`, `account.application.deauthorized`. Updates orders and payments only.
- [ ] 6.12 `POST /api/pay/checkout`: creates a Stripe Checkout Session on the studio's account (`Stripe-Account` header), no application fee, studio branding, success and cancel URLs on the tenant host.
- [ ] 6.13 Disconnect button: calls deauthorize (OAuth) or clears the stored account id; existing orders keep their history.
- [ ] 6.14 Manual payments (cash, bank transfer) recorded from studio UI. No refund button; refunds are done in Stripe and mirrored by webhook.
- [ ] 6.15 Receipts and payment link emails (sent by us; the Stripe receipt is the studio's own setting).
- [ ] 6.16 Billing emails: trial ending, payment failed, subscription cancelled.
- [ ] 6.17 Fallback setting "I'll collect payment myself": pay page shows the studio's instructions or pasted Payment Link; studio marks orders paid by hand.

## Phase 7. Marketing site (root domain)

- [ ] 7.1 Marketing layout: header, nav, footer with legal links.
- [ ] 7.2 Home: hero ("Cull in Lightroom. Deliver in one click. Get paid in your own Stripe."), three-step flow, product tour sections (website templates, galleries, CRM, payments, Lightroom, team days), pricing teaser, FAQ, final CTA.
- [ ] 7.3 `/pricing` with monthly/yearly toggle, feature matrix, "0% commission, your own Stripe" callout, referral note, FAQ.
- [ ] 7.4 `/features/website`, `/features/galleries`, `/features/crm`, `/features/payments`, `/features/lightroom`, `/features/team-headshots`.
- [ ] 7.5 `/compare/pixieset`, `/compare/pic-time`, `/compare/shootproof`, `/compare/cloudspot`, `/compare/honeybook` from the research.
- [ ] 7.6 `/security`, `/terms`, `/privacy`, `/cookies`, `/dpa`, `/referrals` (program terms).
- [ ] 7.7 `/contact` (leads table, rate limit, notice email).
- [ ] 7.8 `/changelog` placeholder and `/status` link.
- [ ] 7.9 `sitemap.ts`, `robots.ts`, `opengraph-image.tsx`, JSON-LD.
- [ ] 7.10 Accessibility pass: landmarks, focus states, contrast.

## Phase 8. Studio shell and onboarding

- [~] 8.1 Studio layout: sidebar (Dashboard, Inbox, Clients, Sessions, Galleries, Website, Portfolio, Assets, Emails, Referrals, Settings), top bar with studio switcher and user menu.
- [x] 8.2 Onboarding checklist card with progress: verify email, brand, pick template and publish, connect Stripe, first package, first client, first gallery, Lightroom.
- [~] 8.3 Dashboard stats: live galleries, unanswered notes, unpaid balances, upcoming shoots, storage.
- [~] 8.4 Dashboard to-do list generated from data.
- [~] 8.5 Dashboard recent activity from audit log.
- [ ] 8.6 Global search (clients, galleries, sessions) via query param.
- [ ] 8.7 Suspended and delinquent states with clear messaging.

## Phase 9. CRM

- [ ] 9.1 Inbox: inquiries and booking requests, mark read, convert to client, reply (email), archive.
- [ ] 9.2 Clients list: stage tabs, search, sort, CSV export and import, add client.
- [ ] 9.3 Client page header: contact details, stage, next step, quick actions.
- [ ] 9.4 Client timeline: notes, logged calls/emails, system events (gallery sent, payment received).
- [ ] 9.5 Client tasks with due dates; tasks list on dashboard.
- [ ] 9.6 Client sessions section: create from package, edit, payment link, mark paid, delete.
- [ ] 9.7 Client galleries section: create proofs/finals, status, picks, notes.
- [ ] 9.8 Client documents: signed agreement view and print view.
- [ ] 9.9 Merge duplicate clients by email.
- [ ] 9.10 Tags on clients (e.g., corporate, actor) with filter.
- [ ] 9.11 Broadcast email to a filtered client list (respecting unsubscribe), sent from the studio's domain when verified.
- [ ] 9.12 Client unsubscribe link and suppression list.

## Phase 10. Sessions, packages and payments UI

- [ ] 10.1 Packages CRUD with deposit, included finals, extra pick price, show-on-site toggle.
- [ ] 10.2 Session detail: money summary, payments list (from webhook), agreement status, gallery links, link to the charge in the studio's Stripe Dashboard.
- [ ] 10.3 Payment link copy and email; QR code for in-person.
- [ ] 10.4 Manual payment, undo, partial payments.
- [ ] 10.5 Refund state mirrored from Stripe (`charge.refunded`); no refund action in our UI.
- [ ] 10.6 Sessions list (upcoming, past) and iCal feed per studio (token URL).
- [ ] 10.7 Agreement template editor: studio can edit clause text; version stamped per signature.
- [ ] 10.8 Printable invoice and receipt page per session (client-facing, PDF via browser print).
- [ ] 10.9 Month calendar view of sessions.

## Phase 11. Galleries and proofing (studio side)

- [ ] 11.1 Galleries list with filters (kind, status, client) and counts.
- [ ] 11.2 Create gallery (client, kind, title, from session).
- [ ] 11.3 Gallery settings: title, kind, welcome, downloads, expiry, password vs code, watermark toggle, allow comments.
- [ ] 11.4 Publish/unpublish, new code, send email (template), preview link.
- [ ] 11.5 Upload: browser direct-to-Blob with presigned URLs, progress, server preview + thumbnail generation, quota check.
- [ ] 11.6 Photo grid: reorder (drag or arrows), rename, delete, bulk select and delete.
- [ ] 11.7 Notes panel: reply, resolve, unresolved filter.
- [ ] 11.8 Favorites list with export (CSV of filenames) and "copy filenames for Lightroom".
- [ ] 11.9 Watermark on previews (text watermark from studio name) when enabled.
- [ ] 11.10 Gallery analytics: views, unique visitors, downloads, last opened.
- [ ] 11.11 Duplicate gallery into finals from favorites.
- [ ] 11.12 Team headshot event: create event, add people list, generate child galleries and codes, manager summary page, per-person email send.
- [ ] 11.13 Gallery expiry automation and reminder email.
- [ ] 11.14 Optional download PIN separate from the access code.
- [ ] 11.15 Download size options: web (1600px) and full resolution, per gallery.
- [ ] 11.16 Pay-gated downloads: finals locked until the order balance is paid (webhook-driven), with a clear "pay to unlock" state.
- [ ] 11.17 Client upload: allow a client to send reference images or a headshot brief to the gallery (optional toggle).

## Phase 12. Tenant client surfaces

- [ ] 12.1 Tenant layout: theme from site settings, logo, nav from enabled pages, footer, noindex on galleries.
- [ ] 12.2 `/g` open-your-gallery code entry.
- [ ] 12.3 `/g/[slug]`: locked, unlock with rate limit, grid, lightbox, favorites, notes, downloads, zip, lock, closed/expired states, "Powered by" badge on Free.
- [ ] 12.4 `/pay/[orderId]`: agreement, deposit or full choice, redirect to Stripe Checkout on the studio's account, success and cancel pages, "You paid {Studio}" wording.
- [ ] 12.5 `/team/[eventSlug]` manager overview.
- [ ] 12.6 `GET /api/photo/[id]` access-checked streaming with paid-lock and ETag.
- [ ] 12.7 `GET /api/gallery/[id]/zip` streaming.
- [ ] 12.8 Analytics beacon (`POST /api/track`) for gallery and site views.
- [ ] 12.9 Client hub `/my` via emailed magic link: all of a client's galleries, sessions, payments and documents in one place.
- [ ] 12.10 Gallery slideshow mode (full screen, keyboard, autoplay).
- [ ] 12.11 Social sharing controls: allow/disallow, share image with studio watermark.

## Phase 13. Tenant public website (two templates)

- [ ] 13.1 Template registry: `editorial` and `gallery`, each a set of React section components with the same section schema, so switching templates keeps the studio's text and images.
- [ ] 13.2 Home sections (each toggleable): hero (background image, heading, subheading, button), intro (text, feature image), portfolio strip (pulls from portfolio), packages (pulls active packages), testimonials (pulls reviews), FAQ (editable list), location (address, hours, map link), final CTA.
- [ ] 13.3 Portfolio page: hero, category filter, grid, lightbox.
- [ ] 13.4 Pricing page: hero, packages, "what's included" list, FAQ, CTA.
- [ ] 13.5 About page: hero, bio text with portrait, process steps (editable list), CTA.
- [ ] 13.6 Contact page: hero, contact form (posts to inquiries and booking_requests; rate limit; honeypot; notice email), contact details, map link.
- [ ] 13.7 Open-your-gallery page: code entry with the template's styling.
- [ ] 13.8 Local area pages (toggle): studio enters a list of towns; `/headshots/[town]` renders templated copy with the town name; listed in sitemap.
- [ ] 13.9 Website editor `/studio/website`: left column is a list of pages and their sections with on/off switches; right column is a live preview iframe of the draft; clicking a section opens its fields (text inputs, image picker, button label). Save as draft; Publish copies draft to live.
- [ ] 13.10 Appearance panel: template switch (with preview), primary color, accent color, light or dark base, font pairing (3), logo, favicon.
- [ ] 13.11 SEO panel: site title, description, OG image, per-page title and description; LocalBusiness JSON-LD from business details.
- [ ] 13.12 Reviews manager (add, edit, publish, order) feeding the testimonials section.
- [ ] 13.13 Site analytics tab: views per page per day.
- [ ] 13.14 Custom domain: instructions, add via Vercel API when configured, verification check, HTTPS note.
- [ ] 13.15 Sitemap and robots per tenant site; galleries excluded.
- [ ] 13.16 Starter copy for headshot studios seeded from the current site's copy so a new studio's site reads well before they edit anything.

## Phase 14. Portfolio and asset library

- [ ] 14.1 Assets page: upload many, grid, search by name/tag, filter by kind, usage count, delete (blocked if in use).
- [ ] 14.2 Asset detail: alt text, tags, replace file, where used.
- [ ] 14.3 Portfolio manager: pick assets, order, categories, featured, publish.
- [ ] 14.4 Image variants: thumb 480, web 1600, original; served from public store for site, private for galleries.
- [ ] 14.5 Storage accounting includes assets and documents.
- [ ] 14.6 Bulk import from a finished gallery into portfolio (with client consent flag from agreement).

## Phase 15. Emails, automations and sending domains

- [ ] 15.1 Template keys: inquiry notice, inquiry reply, gallery proofs ready, gallery finals ready, payment link, receipt, agreement copy, balance reminder, gallery expiring, thank you, review request.
- [ ] 15.2 Templates editor with variables list, live preview, test send, reset to default.
- [ ] 15.3 Automations settings: toggle each automation, delay in days.
- [ ] 15.4 Cron executes automations idempotently (one send per target per rule).
- [ ] 15.5 Email log page with filters and resend.
- [ ] 15.6 Unsubscribe handling for broadcast sends.
- [ ] 15.7 Sender identity: display name, from local part, reply-to, signature block.
- [ ] 15.8 `/studio/settings/email-domain` (Pro and Studio): enter a subdomain (we suggest `mail.yourstudio.com`), create in Resend, show the DNS records as a copyable table (host, type, value), "Check now" button, status badge.
- [ ] 15.9 `POST /api/resend/webhook` for `domain.updated` (and bounce/complaint events into the email log).
- [ ] 15.10 Daily re-check of `pending` domains; email the owner when verified or failed.
- [ ] 15.11 Sending switch: once `verified`, all studio-originated mail uses `{local}@{domain}`; platform mail (billing, auth) always uses our domain.
- [ ] 15.12 DMARC helper: show the suggested `v=DMARC1; p=none; rua=mailto:...` record with an explanation; not required to send.
- [ ] 15.13 Resend plan check documented in SETUP: our account must be on a plan with enough domains (Pro 10, Scale 1,000, or the 100-domain add-on); platform admin shows domains used vs limit.
- [ ] 15.14 Remove a domain: deletes in Resend, falls back to platform sender.

## Phase 16. Settings, team and integrations

- [ ] 16.1 Settings hub with tabs: Profile, Branding, Website, Domain, Payments, Email domain, Emails, Team, Lightroom, Referrals, Billing, Data.
- [ ] 16.2 Branding: name, legal name, logo upload, brand color, currency, timezone, contact details.
- [ ] 16.3 Team: members list, invite, roles, remove, pending invites, resend/revoke.
- [ ] 16.4 Lightroom: tokens create/revoke, download plugin, install guide.
- [ ] 16.5 Data: export everything (JSON + CSV), request deletion, delete studio (soft, cancels subscription, disconnects Stripe).
- [ ] 16.6 Audit log viewer.

## Phase 17. Lightroom API and plugin

- [ ] 17.1 `withApi` wrapper: token → studio, JSON errors, per-token rate limit, revoked check.
- [ ] 17.2 Endpoints: ping, clients, galleries, photos begin/complete/delete, feedback, comments, selections.
- [ ] 17.3 Quota enforcement on upload begin.
- [ ] 17.4 Plugin files renamed to the final name; config with site URL placeholder.
- [ ] 17.5 Plugin: publish, republish, delete, comments and favorites sync, keyword tagging, open gallery, open studio.
- [ ] 17.6 Download route for the zip; version shown in studio.

## Phase 18. Platform admin

- [ ] 18.1 Guard and layout.
- [ ] 18.2 Studios list with plan, status, storage, members, Stripe connected, sending domain status, created, last activity; suspend/unsuspend; read-only impersonation link.
- [ ] 18.3 Metrics: studios by plan, MRR estimate, signups per week, storage, active galleries, referrals granted.
- [ ] 18.4 Leads list.
- [ ] 18.5 Email log across studios, failure rate, Resend domain count vs plan limit.
- [ ] 18.6 Referral review: list, void suspicious ones, re-grant.
- [ ] 18.7 `GET /api/health`.

## Phase 19. Quality and delivery

- [ ] 19.1 Unit tests: plans, entitlements, slug, password, tenant host, order money, access codes, templates rendering, site section schemas, referral rules, sending-domain status mapping.
- [ ] 19.2 Integration-style tests for pure server helpers with a fake db where practical.
- [ ] 19.3 `typecheck` clean.
- [ ] 19.4 `lint` clean.
- [ ] 19.5 `build` succeeds with no env vars.
- [ ] 19.6 `docs/SETUP.md` runbook (Vercel Pro, Neon, Blob, Stripe platform profile and Connect settings, Resend plan, DNS).
- [ ] 19.7 `docs/ARCHITECTURE.md`.
- [ ] 19.8 `docs/LAUNCH-CHECKLIST.md`: legal, Stripe live mode, domains, backups, monitoring.
- [ ] 19.9 Commit per phase, push, PR updated.
- [ ] 19.10 Backup and restore procedure (Neon point-in-time restore, Blob export) documented and tested once.
- [ ] 19.11 Load test of gallery page and photo route with 300 photos; image route p95 under 300 ms from cache.
- [ ] 19.12 Accessibility audit of gallery and pay pages (keyboard, screen reader labels, contrast).

## Phase 20. Referral program

- [ ] 20.1 Every studio has a referral code and link `APP_URL/signup?ref=CODE`, shown on `/studio/referrals` with copy button and a prewritten email/text.
- [ ] 20.2 Signup stores `referred_by_code`; a `referrals` row moves to `signed_up`.
- [ ] 20.3 Reward trigger: the referred studio's first `invoice.paid` with amount > 0. Then: apply the coupon to the referred studio's subscription (100% off one month on monthly, 10% off once on yearly) and the same to the referrer's subscription. If the referrer is on Free, hold the credit until they subscribe (stored as a pending reward, applied at checkout).
- [ ] 20.4 Fraud rules: no self-referral (same user, same payment method fingerprint, same verified email domain if not a public provider); max 12 rewards per referrer per rolling year; referrals void if the referred studio refunds or disputes its first invoice within 30 days (reward reversed by removing the discount from the next invoice where possible).
- [ ] 20.5 Emails: "Your friend signed up", "You earned a free month", "Your free month was applied".
- [ ] 20.6 `/studio/referrals` page: link, stats (invited, signed up, rewarded), list with status.
- [ ] 20.7 Marketing: referral mention on pricing and in the onboarding checklist; `/referrals` terms page.
- [ ] 20.8 Platform admin view (18.6).

## Phase 21. Proposed additions from the outside analysis (need approval)

- [ ] 21.1 `[?]` Migration import: upload a zip (or several) exported from Pixieset, Pic-Time or ShootProof; create galleries from folder names, keep filenames, optional client CSV to attach clients; progress page; import log. Old links cannot be preserved (they live on the other vendor's domain), but the same access codes can be re-used.
- [ ] 21.2 `[?]` Booking page: studio sets weekly availability and session length per package; `/book` on the tenant site shows open slots; a booking creates a client, a session from the package, a booking request, and a payment link for the deposit. No calendar sync in v1 (iCal feed only).
- [ ] 21.3 `[?]` Session planning: notes, shot list (checklist), mood board (pick assets or upload references) on the session page, with a client-visible version.
- [ ] 21.4 `[?]` Import clients from CSV with column mapping (fits 9.2).

## Removed (by decision, not deferred)

- [-] Platform fee on client payments, and any platform handling of refunds, disputes, payouts or KYC.
- [-] Page builder with arbitrary blocks and custom HTML (replaced by two templates).
- [-] Two-factor auth and SSO.
- [-] Outbound webhooks.
- [-] Blog/CMS posts on tenant sites.
- [-] Print sales and lab fulfillment.

## Deferred

- [-] Native mobile apps: responsive web instead.
