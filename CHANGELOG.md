# Changelog

Newest first. One line per meaningful change; phase numbers refer to docs/BUILD-PLAN.md.

## Unreleased

- Phase 1: env example for one plan and Connect OAuth; stripe:setup creates one price, the referral coupon and webhook endpoints; check-env preflight; CI workflow; cron schedules.
- Phase 3: single Studio plan at $40/month; billingState() replaces entitlements; all plan limits removed.
- Phase 2: studios schema for one plan (plan_override, read_only_since, grace_ends_at; billing_interval dropped).
- Foundation: scaffold, schema, core libraries, design system, auth pages, studio shell (from the first commit).
