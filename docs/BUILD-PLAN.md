# Proofroom build plan

A multi-tenant platform for photographers. Each studio gets: a customizable public website (home, portfolio, pricing, about, contact, custom pages, local landing pages), branded client galleries with proofing, deposits and e-signed agreements, a CRM (leads, clients, sessions, tasks), an asset library, email templates and automations, team seats, and a two-way Lightroom Classic plugin. Built as a separate app in `saas/`, deployed to its own Vercel project and domain.

Working name: **Proofroom** (proofroom.com was available on Sept 8, 2026; the name is one env var).

Legend: `[ ]` not started, `[x]` done, `[~]` in progress, `[-]` deferred (reason noted). Every item is one small, verifiable piece with a file or behaviour to check.

---

## Phase 0. Decisions (locked)

- [x] 0.1 App in `saas/`, own `package.json`, separate Vercel project (Root Directory `saas`).
- [x] 0.2 Next.js 16.3.4 App Router, React 19, TypeScript strict, Tailwind 4. Cache Components off.
- [x] 0.3 Neon Postgres via serverless HTTP driver, plain SQL, bound parameters, idempotent schema applied on every build.
- [x] 0.4 Tenant = `studios`; every domain table has `studio_id`; users join via `memberships` (owner, admin, member).
- [x] 0.5 Tenant hosts `{slug}.APP_DOMAIN` and verified custom domains rewrite to `/t/{slug}/...`, which also works on the root host and previews.
- [x] 0.6 Auth: scrypt passwords, DB sessions in httpOnly cookie, hashed one-time tokens, Postgres rate limits, lockout.
- [x] 0.7 Billing: Stripe subscriptions (Checkout, Portal, webhooks). Free, Starter $12, Pro $24, Studio $49 (yearly $10/$20/$40 per month). 14-day Pro trial. 0% commission.
- [x] 0.8 Client payments: Stripe Connect Express, direct charges on the studio's account, optional platform fee via env.
- [x] 0.9 Storage: Vercel Blob private (photos, documents) and public (site images, logos). Usage metered per studio.
- [x] 0.10 Email: Resend from platform domain, studio name as display name, reply-to studio.
- [x] 0.11 Lightroom plugin generalized (`com.proofroom.lightroom`, tokens `pr_live_...`).
- [x] 0.12 Vercel Pro required for commercial use; documented.
- [x] 0.13 Tenant public website is data-driven: pages are rows with JSON blocks; a fixed set of well-designed section types, editable copy and images, no arbitrary code.
- [x] 0.14 Asset library: one `assets` table for every uploaded image (portfolio, site sections, logo), referenced by id, with usage counts.

## Phase 1. Scaffold and tooling

- [x] 1.1 `package.json` scripts: dev, build, start, lint, typecheck, test, db:migrate, stripe:setup, plugin:zip, platform:admin.
- [x] 1.2 `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`.
- [x] 1.3 `next.config.ts`: image patterns, Server Actions allowed origins for wildcard hosts, security headers.
- [x] 1.4 `.env.example` with every variable documented.
- [x] 1.5 `.gitignore`.
- [x] 1.6 `scripts/db-migrate.mjs`.
- [x] 1.7 `scripts/stripe-setup.mjs` (idempotent products and prices by lookup key).
- [x] 1.8 `scripts/make-platform-admin.mjs`.
- [x] 1.9 `scripts/plugin-zip.mjs` stamping the site URL.
- [ ] 1.10 `.github/workflows/saas.yml`: install, typecheck, lint, test, build without secrets.
- [ ] 1.11 `vercel.json` in `saas/` with cron schedule for `/api/cron/daily`.

## Phase 2. Database schema

- [x] 2.1 `users`, `studios`, `memberships`, `invitations`, `sessions`, `auth_tokens`, `rate_limits`, `audit_log`, `api_tokens`, `stripe_events`.
- [x] 2.2 `clients`, `inquiries`, `packages`, `orders`, `payments`.
- [x] 2.3 `galleries` (with `parent_id`, `subject_name`), `photos`, `photo_comments`, `photo_selections`.
- [x] 2.4 `email_templates`, `email_log`, `leads`.
- [ ] 2.5 `assets`: every uploaded image (url, width, height, bytes, alt, tags, kind portfolio|site|logo|document, folder).
- [ ] 2.6 `portfolio_items`: ordered, categorized, featured flag, references `assets`.
- [ ] 2.7 `site_pages`: slug, title, kind (home, portfolio, pricing, about, contact, custom, area), blocks jsonb, seo jsonb, nav_label, nav_order, published.
- [ ] 2.8 `site_settings` on studio (`settings` jsonb): theme (colors, font, dark/light), nav, footer, social links, business address, hours, analytics id, custom head tags (allowlisted).
- [ ] 2.9 `reviews`: name, body, rating, published, order.
- [ ] 2.10 `tasks`: per studio, optional client/order, due date, done.
- [ ] 2.11 `client_notes`: timeline entries per client (note, call, email logged).
- [ ] 2.12 `analytics_events`: gallery_view, photo_view, download, favorite, site_view with day buckets.
- [ ] 2.13 `booking_requests`: from the site contact/booking form with package, preferred dates.
- [ ] 2.14 `automations` settings: reminders for unpaid balance, gallery expiring, unanswered notes (in `settings`).
- [ ] 2.15 `documents`: uploaded PDFs (signed agreements export, invoices) in private store.
- [ ] 2.16 Indexes for every studio-scoped list query; unique constraints per studio.
- [ ] 2.17 Seed defaults in code when a studio is created: packages, site pages with starter copy, email templates, theme.

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
- [x] 3.12 `stripe.ts` platform and connected clients, price lookup.
- [x] 3.13 `storage.ts` two stores, per-studio paths.
- [x] 3.14 `images.ts` previews, logos.
- [x] 3.15 `email.ts` Resend with per-studio from/reply-to and logging.
- [x] 3.16 `emails/account.ts`, `emails/studio.ts`.
- [x] 3.17 `contract.ts` per-studio agreement.
- [x] 3.18 `types.ts` rows and money.
- [x] 3.19 `gallery-access.ts`.
- [x] 3.20 `validation.ts` zod schemas.
- [x] 3.21 `action-state.ts`, `logger.ts`.
- [x] 3.22 `account.ts`: create user+studio, defaults, credentials with lockout, one-time tokens.
- [x] 3.23 `usage.ts`: recompute and cache storage bytes, count active galleries, members.
- [x] 3.24 `site.ts`: block types, default pages, render helpers, theme CSS variables.
- [ ] 3.25 `assets.ts`: upload pipeline (validate, resize variants, record, usage).
- [x] 3.26 `analytics.ts`: record events (deduped per visitor per day), summaries.
- [ ] 3.27 `domains.ts`: Vercel Domains API add/verify (optional when token present), DNS instructions.
- [ ] 3.28 `zip.ts`: streaming zip of gallery originals.
- [ ] 3.29 `csv.ts`: export clients and payments.
- [x] 3.30 `email-templates.ts`: keys, variables, defaults, rendering with placeholders.

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

## Phase 5. Authentication and accounts

- [x] 5.1 Auth layout.
- [x] 5.2 Actions: signup, login, logout, forgot, reset, resend verification, accept invite, switch studio, create additional studio, slug check.
- [x] 5.3 `/signup` page with live subdomain availability and password guidance.
- [x] 5.4 `/login` page with next redirect.
- [x] 5.5 `/forgot-password`, `/reset-password` pages.
- [x] 5.6 `/verify-email` route consumes token and redirects with a banner.
- [x] 5.7 `/logout` route.
- [x] 5.8 `/invite/[token]` page (new or existing user).
- [x] 5.9 `/api/slug-check` for the signup form.
- [ ] 5.10 Account page: name, email (re-verify on change), password change (requires current), active sessions with revoke, delete account request.
- [ ] 5.11 Verification banner in studio shell with resend.

## Phase 6. Billing, plans and Connect

- [ ] 6.1 `/studio/billing` page: plan, trial, usage meters, invoices, upgrade, portal.
- [ ] 6.2 `POST /api/billing/checkout`.
- [ ] 6.3 `POST /api/billing/portal`.
- [ ] 6.4 `POST /api/stripe/webhook` subscription lifecycle with idempotency.
- [ ] 6.5 Entitlement checks in gallery create, upload begin, invite member, custom domain, branding, team events, site publish.
- [ ] 6.6 Upgrade prompts component (inline, links to billing with reason).
- [ ] 6.7 `GET /api/cron/daily`: trial reminders (3 days, 1 day), downgrade expired trials, expire galleries, payment reminders, digest.
- [ ] 6.8 `POST /api/connect/onboard` Express account + Account Link; `/studio/settings/payments` return handler refreshes status.
- [ ] 6.9 Connect status refresh helper and webhook `account.updated`.
- [ ] 6.10 `POST /api/pay/checkout` on connected account (Payment Element), fee option.
- [ ] 6.11 `POST /api/stripe/connect-webhook`: payment completed, async success, refund.
- [ ] 6.12 Manual payments and refunds recorded from studio UI.
- [ ] 6.13 Receipts and payment link emails.
- [ ] 6.14 Billing emails: trial ending, payment failed, subscription cancelled.

## Phase 7. Marketing site (root domain)

- [ ] 7.1 Marketing layout: header, nav, footer with legal links.
- [ ] 7.2 Home: hero, three-step flow, product tour sections (website, galleries, CRM, payments, Lightroom, team days), pricing teaser, FAQ, final CTA.
- [ ] 7.3 `/pricing` with monthly/yearly toggle, feature matrix, 0% commission callout, FAQ.
- [ ] 7.4 `/features/website`, `/features/galleries`, `/features/crm`, `/features/payments`, `/features/lightroom`, `/features/team-headshots`.
- [ ] 7.5 `/compare/pixieset`, `/compare/pic-time`, `/compare/shootproof`, `/compare/cloudspot`, `/compare/honeybook` from the research.
- [ ] 7.6 `/security`, `/terms`, `/privacy`, `/cookies`, `/dpa`.
- [ ] 7.7 `/contact` (leads table, rate limit, notice email).
- [ ] 7.8 `/changelog` placeholder and `/status` link.
- [ ] 7.9 `sitemap.ts`, `robots.ts`, `opengraph-image.tsx`, JSON-LD.
- [ ] 7.10 Accessibility pass: landmarks, focus states, contrast.

## Phase 8. Studio shell and onboarding

- [~] 8.1 Studio layout: sidebar (Dashboard, Inbox, Clients, Sessions, Galleries, Website, Portfolio, Assets, Emails, Settings), top bar with studio switcher and user menu.
- [x] 8.2 Onboarding checklist card with progress: verify email, brand, website publish, payments connect, first package, first client, first gallery, Lightroom.
- [~] 8.3 Dashboard stats: live galleries, unanswered notes, unpaid balances, upcoming shoots, storage.
- [~] 8.4 Dashboard to-do list generated from data.
- [~] 8.5 Dashboard recent activity from audit log.
- [ ] 8.6 Global search (clients, galleries, sessions) via query param.
- [ ] 8.7 Suspended and delinquent states with clear messaging.

## Phase 9. CRM

- [ ] 9.1 Inbox: inquiries and booking requests, mark read, convert to client, reply (email), archive.
- [ ] 9.2 Clients list: stage tabs, search, sort, CSV export, add client.
- [ ] 9.3 Client page header: contact details, stage, next step, quick actions.
- [ ] 9.4 Client timeline: notes, logged calls/emails, system events (gallery sent, payment received).
- [ ] 9.5 Client tasks with due dates; tasks list on dashboard.
- [ ] 9.6 Client sessions section: create from package, edit, payment link, mark paid, refund note, delete.
- [ ] 9.7 Client galleries section: create proofs/finals, status, picks, notes.
- [ ] 9.8 Client documents: signed agreement view and PDF-ish print view.
- [ ] 9.9 Merge duplicate clients by email.
- [ ] 9.10 Tags on clients (e.g., corporate, actor) with filter.
- [ ] 9.11 Bulk email to a filtered client list (respecting unsubscribe).
- [ ] 9.12 Client unsubscribe link and suppression list.

## Phase 10. Sessions, packages and payments UI

- [ ] 10.1 Packages CRUD with deposit, included finals, extra pick price, show-on-site toggle.
- [ ] 10.2 Session detail: money summary, payments list, agreement status, gallery links.
- [ ] 10.3 Payment link copy and email; QR code for in-person.
- [ ] 10.4 Manual payment, undo, partial payments.
- [ ] 10.5 Refund via Stripe (connected account) with reason.
- [ ] 10.6 Sessions calendar list (upcoming, past) and iCal feed per studio (token URL).
- [ ] 10.7 Agreement template editor: studio can edit clause text; version stamped per signature.
- [ ] 10.8 Printable invoice and receipt page per session (client-facing, PDF via browser print).
- [ ] 10.9 Booking calendar view (month) of sessions with shoot dates; iCal subscription URL.

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
- [ ] 11.16 Client upload: allow a client to send reference images or a headshot brief to the gallery (optional toggle).

## Phase 12. Tenant client surfaces

- [ ] 12.1 Tenant layout: theme from site settings, logo, nav from published pages, footer, noindex on galleries.
- [ ] 12.2 `/g` open-your-gallery code entry (site page or standalone).
- [ ] 12.3 `/g/[slug]`: locked, unlock with rate limit, grid, lightbox, favorites, notes, downloads, zip, lock, closed/expired states, "Powered by" badge on Free.
- [ ] 12.4 `/pay/[orderId]`: agreement, payment choice, Payment Element on connected account, success.
- [ ] 12.5 `/team/[eventSlug]` manager overview.
- [ ] 12.6 `GET /api/photo/[id]` access-checked streaming with paid-lock and ETag.
- [ ] 12.7 `GET /api/gallery/[id]/zip` streaming.
- [ ] 12.8 Analytics beacon (`POST /api/track`) for gallery and site views.
- [ ] 12.9 Client hub `/my` via emailed magic link: all of a client's galleries, sessions, payments and documents in one place.
- [ ] 12.10 Gallery slideshow mode (full screen, keyboard, autoplay).
- [ ] 12.11 Social sharing controls: allow/disallow, share image with studio watermark.

## Phase 13. Tenant public website (site builder)

- [ ] 13.1 Block types: hero, text, image+text, gallery grid (from portfolio), packages, testimonials, FAQ, contact form, CTA, stats, map/address, custom HTML (sanitized), spacer.
- [ ] 13.2 Default pages seeded: Home, Portfolio, Pricing, About, Contact, plus "Open your gallery".
- [ ] 13.3 Renderer: `/t/[studio]/[[...page]]` renders published pages by slug with theme.
- [ ] 13.4 Theme editor: primary color, background light/dark, font pairing (3 presets), button style, logo, favicon.
- [ ] 13.5 Page editor: add/remove/reorder blocks, edit copy inline (forms), pick images from asset library, publish/unpublish, preview draft.
- [ ] 13.6 Navigation editor: which pages, order, labels; footer links and social.
- [ ] 13.7 SEO per page: title, description, OG image, canonical; site-wide business schema (LocalBusiness JSON-LD) from settings.
- [ ] 13.8 Local landing pages: generate `/headshots/[town]` pages from a list of service areas with templated copy (the current site's pattern).
- [ ] 13.9 Contact/booking form block posts to inquiries + booking_requests, rate limited, spam honeypot, notice email.
- [ ] 13.10 Pricing block reads active packages with "Book" CTA to contact with package preselected.
- [ ] 13.11 Reviews manager and testimonials block.
- [ ] 13.12 Portfolio page: categories filter, lightbox, lazy loading.
- [ ] 13.13 Site analytics tab: views per page per day.
- [ ] 13.14 Custom domain: instructions, add via Vercel API when configured, verification check, HTTPS note.
- [ ] 13.15 Sitemap and robots per tenant site; galleries excluded.
- [ ] 13.16 Import helper: copy the current studio site's copy (docs/COPY.md pattern) as a template option "Headshot studio".

## Phase 14. Portfolio and asset library

- [ ] 14.1 Assets page: upload many, grid, search by name/tag, filter by kind, usage count, delete (blocked if in use).
- [ ] 14.2 Asset detail: alt text, tags, replace file, where used.
- [ ] 14.3 Portfolio manager: pick assets, order, categories, featured, publish.
- [ ] 14.4 Image variants: thumb 480, web 1600, original; served from public store for site, private for galleries.
- [ ] 14.5 Storage accounting includes assets and documents.
- [ ] 14.6 Bulk import from a finished gallery into portfolio (with client consent flag from agreement).

## Phase 15. Emails and automations

- [ ] 15.1 Template keys: inquiry notice, inquiry reply, gallery proofs ready, gallery finals ready, payment link, receipt, agreement copy, balance reminder, gallery expiring, thank you, review request.
- [ ] 15.2 Templates editor with variables list, live preview, test send, reset to default.
- [ ] 15.3 Automations settings: toggle each automation, delay in days.
- [ ] 15.4 Cron executes automations idempotently (one send per target per rule).
- [ ] 15.5 Email log page with filters and resend.
- [ ] 15.6 Unsubscribe handling for marketing-type sends.
- [ ] 15.7 Sender identity: display name, reply-to, signature block in settings.

## Phase 16. Settings, team and integrations

- [ ] 16.1 Settings hub with tabs: Profile, Branding, Website, Domain, Payments, Emails, Team, Lightroom, Billing, Data.
- [ ] 16.2 Branding: name, legal name, logo upload, brand color, currency, timezone, contact details.
- [ ] 16.3 Team: members list, invite, roles, remove, pending invites, resend/revoke.
- [ ] 16.4 Lightroom: tokens create/revoke, download plugin, install guide.
- [ ] 16.5 Data: export everything (JSON + CSV), request deletion, delete studio (soft, cancels subscription).
- [ ] 16.6 Audit log viewer.
- [ ] 16.7 Webhooks out (optional): studio can register a URL for events; signed payloads. [-] deferred to post-launch.

## Phase 17. Lightroom API and plugin

- [ ] 17.1 `withApi` wrapper: token → studio, JSON errors, per-token rate limit, revoked check.
- [ ] 17.2 Endpoints: ping, clients, galleries, photos begin/complete/delete, feedback, comments, selections.
- [ ] 17.3 Quota enforcement on upload begin.
- [ ] 17.4 Plugin files renamed and generalized; PRConfig.lua with site URL placeholder.
- [ ] 17.5 Plugin: publish, republish, delete, comments and favorites sync, keyword tagging, open gallery, open studio.
- [ ] 17.6 Download route for the zip; version shown in studio.

## Phase 18. Platform admin

- [ ] 18.1 Guard and layout.
- [ ] 18.2 Studios list with plan, status, storage, members, created, last activity; suspend/unsuspend; impersonate read-only view link.
- [ ] 18.3 Metrics: studios by plan, MRR estimate, signups per week, storage, active galleries.
- [ ] 18.4 Leads list.
- [ ] 18.5 Email log across studios and failure rate.
- [ ] 18.6 `GET /api/health`.

## Phase 19. Quality and delivery

- [ ] 19.1 Unit tests: plans, entitlements, slug, password, tenant host, order money, access codes, templates rendering, block schema validation.
- [ ] 19.2 Integration-style tests for pure server helpers with a fake db where practical.
- [ ] 19.3 `typecheck` clean.
- [ ] 19.4 `lint` clean.
- [ ] 19.5 `build` succeeds with no env vars.
- [ ] 19.6 `docs/SETUP.md` runbook.
- [ ] 19.7 `docs/ARCHITECTURE.md`.
- [ ] 19.8 `docs/LAUNCH-CHECKLIST.md`: legal, Stripe live mode, domains, backups, monitoring.
- [ ] 19.9 Commit per phase, push, PR updated.
- [ ] 19.10 Backup and restore procedure (Neon point-in-time restore, Blob export) documented and tested once.
- [ ] 19.11 Load test of gallery page and photo route with 300 photos; image route p95 under 300 ms from cache.
- [ ] 19.12 Accessibility audit of gallery and pay pages (keyboard, screen reader labels, contrast).

## Deferred (documented)

- [-] Print sales and lab fulfillment: no commission model; consider partner later.
- [-] Native mobile apps: responsive web.
- [-] 2FA and SSO: after launch.
- [-] Per-studio sending domains: after launch.
- [-] Outbound webhooks: after launch.
- [-] Blog/CMS posts for tenant sites: custom pages cover static content; posts later.
