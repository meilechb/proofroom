# Changelog

Newest first. One line per meaningful change; phase numbers refer to docs/BUILD-PLAN.md.

## Unreleased

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
