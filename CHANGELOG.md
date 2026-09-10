# Changelog

Newest first. One line per meaningful change; phase numbers refer to docs/BUILD-PLAN.md.

## Unreleased

- Phase 13 complete: tests for signed link-token scope/expiry/tampering and gallery PIN and password verification. Client-facing surfaces (gallery, downloads, pay, hub, invoice/receipt, unsubscribe, team, preview) all built.
- Phase 13 (extras): client photo uploads to a gallery when enabled (stored as uploaded_by=client); team manager overview at /team/[eventSlug] behind the event's manager code, showing each person's opened/photos/picked status.
- Phase 13 (client hub): signed magic-link client portal (/my/[token]) listing galleries, sessions with pay/invoice links, payments with receipts, documents and upcoming bookings, with a re-request form when the link expires; printable invoice and receipt pages; unsubscribe/resubscribe page that also updates the suppression list.
- Phase 13 (downloads): streamed gallery zip with access, PIN and pay-gate checks; single-photo download with PIN on full size; download bar and per-photo download in the client gallery; native share or copy-link; view and download tracking beacon.
- Phase 13 (pay): client pay page with order summary, e-signed agreement (checkbox and typed name), deposit/balance/full options to Checkout on the studio's Stripe account, manual-payment instructions when cards are off, cancelled/paid/already-paid states, and a payment-received success page.
- Phase 13 (start): tenant client gallery: themed layout, code/password unlock with rate limit, photo grid with lazy thumbs, lightbox with keyboard and slideshow, favorites and per-photo notes back to the studio, favorites filter and included-count message, pay-gate banner, expired/closed states; photo streaming API with grant-cookie access and pay-gated full size.
- Phase 12: galleries studio side: list with cover cards and counts, new-gallery flow, gallery detail with direct-to-Blob uploader, selectable photo grid (delete, set cover), settings drawer (access, downloads, pay-gate, watermark, expiry, password, PIN), publish/unpublish, send-to-client email, client notes panel, favorites and create-finals-from-favorites.
- Phase 11: packages management; sessions list, new-session flow and session detail (money, pay link, manual payments, agreement status, galleries, edit, cancel).
- Phase 10: clients CRM (list, detail, timeline, stages, tags, merge, CSV export), inbox (reply, convert, archive) and tasks.
- Phase 9: onboarding wizard (/studio/welcome) with brand, template, packages, Stripe connect, email sender and Lightroom token steps; API token library.
- Phase 8: marketing site: layout with mobile nav, home, pricing, eight feature pages, five comparison pages, Lightroom install guide, security, legal pages (terms, privacy, cookies, DPA, referral terms, fair use), contact form, changelog, sitemap, robots, Open Graph image, JSON-LD, page-view beacon. Health route.
- Phase 3 complete except types/tests sweep: gallery, photo, CRM, email, sending-domain, automation, referral, booking, planning, import and site libraries.
- Phase 4: tenant headers in proxy, loading skeleton, toast, dialog, drawer, tabs, menu, icons, fields, pagination, search, data table, stepper, uploader, lightbox, print styles, /dev/ui.

- Fix: production build failed because Tailwind 4 cannot @apply plain classes; btn, input and badge are now @utility. Turbopack root pinned to saas/.
- Phase 2: revision 4 schema: Stripe connection, referral and site columns; client stage; payment refund and dispute state; gallery access options; photo provenance; new tables for client events, agreements, gallery analytics, areas, sending domains, suppressions, broadcasts, referrals, imports, bookings, session plans; list indexes; updated_at triggers; schema idempotency test.
- Phase 3: withTx, requireWritableStudio, rate-limit presets, tenant URL helpers, referral code generator, default agreement template, billing library (customer, subscription Checkout, portal, snapshot, read-only transition).

- Phase 1: env example for one plan and Connect OAuth; stripe:setup creates one price, the referral coupon and webhook endpoints; check-env preflight; CI workflow; cron schedules.
- Phase 3: single Studio plan at $40/month; billingState() replaces entitlements; all plan limits removed.
- Phase 2: studios schema for one plan (plan_override, read_only_since, grace_ends_at; billing_interval dropped).
- Foundation: scaffold, schema, core libraries, design system, auth pages, studio shell (from the first commit).
