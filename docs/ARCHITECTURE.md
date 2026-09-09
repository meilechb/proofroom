# Architecture

Short descriptions of how the pieces fit. Sections marked "to write" are filled in as their phase is built.

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

## Client payments (to write in full)

- Each studio connects its own Stripe account (OAuth for existing accounts, Account Links for new ones). Charges are created on that account with the `Stripe-Account` header, no application fee. We mirror status from the connected-accounts webhook. See BUILD-PLAN Decision 0.8.

## Storage and images (to write in full)

- Vercel Blob, two stores. Originals private; previews and thumbnails generated with sharp; site assets public.

## Email and sending domains (to write in full)

- Resend. Platform mail from our domain; studio mail from the studio's verified subdomain when present, else our domain with the studio's name and reply-to.

## Lightroom API and plugin (to write in full)

- Bearer tokens per studio (`api_tokens`). Publish, republish, delete, and feedback (favorites, comments) back into Lightroom.

## Tables

To write: one line per table once Phase 2 is complete (plan item 2.68).
