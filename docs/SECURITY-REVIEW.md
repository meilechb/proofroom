# Security review — tenant scoping and hardening

Every Server Action and API route was reviewed for tenant scoping (plan 22.7).
The rule: a request may only read or write rows belonging to the studio it is
authenticated for. This is enforced in three ways depending on the surface.

- **Studio app** (`/studio/**`, Server Actions): `requireStudioPage(minRole)` for
  reads and `requireWritableStudio(minRole)` for writes resolve the signed-in
  user, their active studio, and role. Every query then filters by
  `studio_id = ${studio.id}`; ids from the client are always constrained by that
  studio in the `where` clause, so a guessed id from another studio returns "not
  found" rather than leaking.
- **Tenant/client pages** (`/t/[slug]/**`): the proxy resolves the host to a
  slug; `studioBySlug` loads the studio, and gallery/order/booking lookups filter
  by that studio's id. Client identity comes from a signed magic-link token
  (`verifyLink("hub", …)`), never from a client-supplied id.
- **Lightroom API** (`/api/lr/**`): `withApi` maps a bearer token to one studio,
  rate-limits per token, and blocks writes for read-only tokens. Handlers scope
  every query to that studio.

## Checklist by area (22.7.1–22.7.10)

| # | Area | Entry points | Scoping mechanism |
|---|------|--------------|-------------------|
| 22.7.1 | Auth & account | `(auth)/*`, account actions | Session cookie → user; account actions act on the current user/membership only; role changes gated by `requireWritableStudio("owner"/"admin")`. |
| 22.7.2 | Clients & inquiries | `/studio/clients`, contact action | `requireWritableStudio`; client rows filtered by `studio_id`. Public contact action resolves studio by slug and inserts under it; honeypot + rate limit. |
| 22.7.3 | Sessions, packages, payments | `/studio/sessions`, `/studio/packages`, `/api/pay/checkout` | Studio-scoped reads/writes. Pay checkout verifies `order.studio_id` matches the host slug and `billingState().publicLive` before creating a Checkout Session on the studio's own account. |
| 22.7.4 | Galleries & photos | `/studio/galleries`, `/api/photo/[id]`, `/g/[slug]` | Gallery/photo queries filter by `studio_id`; client gallery access checked by grant cookie / access code / pay-gate; signed streaming. |
| 22.7.5 | Website & assets | `/studio/website`, `/studio/assets` | Site draft/publish and assets scoped by `studio_id`; asset picker and mood board keep only studio-owned ids (`ownedAssets`). |
| 22.7.6 | Emails & sending domains | `/studio/emails`, `/studio/settings/email-domain`, Resend webhook | Templates, automations, suppressions scoped by `studio_id`. Resend webhook verifies the Svix signature before mirroring events. |
| 22.7.7 | Billing & Stripe connection | `/studio/billing`, `/api/connect/**`, `/api/stripe/webhook` | Connection state per studio; platform subscription webhook verifies the Stripe signature; client charges are direct charges on the studio account (no platform fee). |
| 22.7.8 | Lightroom API | `/api/lr/**` | Bearer token → one studio via `withApi`; 120/min per token; read-only tokens cannot write; `X-LR-Api-Version` echoed. |
| 22.7.9 | Referrals | `/studio/referrals`, referral allocation | Referral code per studio; rewards keyed to the referred studio's first invoice; void on refund/dispute. |
| 22.7.10 | Platform admin | `/admin/**`, impersonation | Gated by `user.is_platform_admin`. Impersonation is read-only (billing `canWrite=false`) behind a signed `pr_impersonate` cookie with an audit entry and a visible banner. |

## Cross-cutting controls

- **CSRF (22.8):** Server Actions run same-origin; Next's Server Action origin
  check applies to tenant hosts. API routes require either a bearer token
  (Lightroom) or a provider signature (Stripe, Resend), or are same-origin form
  posts with their own rate limit (pay checkout).
- **Secrets in logs (22.9):** `log.*` runs every payload through `redact()`,
  which masks secret-looking keys (`*token*`, `*secret*`, `authorization`,
  `cookie`, …) and secret-shaped values (`sk_live_…`, `whsec_…`, bearer/JWT).
  Covered by `tests/logger.test.ts`.
- **Upload validation (22.10):** direct-to-Blob uploads use a per-file client
  token bound to one pathname, a size cap and an allow-list of content types;
  filenames are sanitized (`safeFilename`); gallery imports accept only image
  extensions (`isImageEntry`) and never SVG.
- **Rate limits (22.11):** login, signup, password reset, gallery unlock,
  contact, booking, pay checkout and the Lightroom API are rate-limited via
  `limited(action, key)`.

## Still to verify before launch (need production)

- 22.12 `npm audit` triaged (3 moderate advisories from the coverage toolchain
  at review time; none reachable at runtime — document or upgrade).
- 22.13 Response headers scanned (HSTS, CSP report-only → enforce).
- 22.14 Neon point-in-time restore exercised once; Blob export script run.
