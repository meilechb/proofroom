# Pricing build plan — Free tier + Pro at $18/seat/month

Granular, one-at-a-time breakdown of the approved pricing change (design doc lives in the
session plan; product decisions are settled). Same conventions as `BUILD-PLAN.md`:

Legend: `[ ]` not started, `[x]` done, `[~]` partly done, `[-]` dropped by decision.
Every item is one small, verifiable piece — a function, a column, a copy block, a gate
site, a UI state, a test case, or a doc line. Items are numbered `phase.item(.sub)` and
built in order unless a dependency is noted. Each item (or small group) is committed on
its own with typecheck, lint and tests green before every push.

**Scope in one line:** turn the single `$40 studio` plan into **Free** (1 seat, 5 GB cap,
feature-gated) and **Pro** (`$18`/seat/month, per-seat Stripe quantity, uncapped);
new studios trial full Pro for 14 days then **downgrade to Free** instead of going
read-only; introduce the app's first per-feature entitlement layer.

Settled decisions carried into every item below:
- **D1** paying Pro that cancels or fails terminally → **downgrade to Free** (data kept), not lock/purge.
- **D2** Free storage cap = **5 GB** (`FREE_STORAGE_BYTES`, one constant).
- **D3** over-cap Free studio: existing content stays live and downloadable; **new uploads blocked**; no auto-delete.
- **D4** extra seats on a Free studio: owner stays active; other members see "ask the owner to upgrade"; no rows deleted.

Naming: keep `pro` / `free` as the `PlanId` values; Stripe per-seat price lookup key
`pro_seat_monthly`, env `STRIPE_PRICE_PRO_SEAT_MONTHLY`.

---

## Phase 1 — `plans.ts`: constants, catalog, entitlements

- [x] 1.1 Add `FREE_STORAGE_BYTES = 5 * 1024 ** 3` with a comment (tunable; D2).
- [x] 1.2 Add `PRO_SEAT_CENTS = 1800` constant.
- [x] 1.3 Change `export type PlanId = "studio"` → `export type PlanId = "free" | "pro"`.
- [x] 1.4 Define `type Plan = { id: PlanId; name: string; tagline: string; highlights: string[]; pricePerSeatCents?: number; lookupKey?: string; priceEnvName?: string }`.
- [x] 1.5 Build `PLANS: Record<PlanId, Plan>` with a `free` entry (no price fields).
- [x] 1.6 Add the `pro` entry: `pricePerSeatCents: PRO_SEAT_CENTS`, `lookupKey: "pro_seat_monthly"`, `priceEnvName: "STRIPE_PRICE_PRO_SEAT_MONTHLY"`.
- [x] 1.7 Write Free `highlights` (galleries, proofing, own-Stripe payments, Lightroom, subdomain site, CRM basics).
- [x] 1.8 Write Pro `highlights` (everything + team seats, custom domain, own email domain, automations, booking, import, session planning, no badge).
- [x] 1.9 Keep a back-compat `export const PLAN = PLANS.pro` alias only if any import still needs it; otherwise remove and fix imports (see Phase 11). Decide and note in the item.
- [x] 1.10 Define `export type Entitlements = { storageBytes: number | null; maxSeats: number | null; customDomain: boolean; sendingDomain: boolean; automations: boolean; booking: boolean; imports: boolean; sessionPlanning: boolean; removeBranding: boolean; referralReward: boolean; payments: boolean; lightroom: boolean }`.
- [x] 1.11 `export const FREE_ENTITLEMENTS: Entitlements` — `storageBytes: FREE_STORAGE_BYTES`, `maxSeats: 1`, `payments: true`, `lightroom: true`, all Pro-only flags `false`.
- [x] 1.12 `export const PRO_ENTITLEMENTS: Entitlements` — `storageBytes: null`, `maxSeats: null`, every flag `true`.
- [x] 1.13 `export function entitlements(plan: PlanId): Entitlements` returning the matching constant.
- [x] 1.14 JSDoc at top of file rewritten: two tiers, entitlements are the gate, `billingState` maps status → effectivePlan.
- [x] 1.15 Keep `formatPrice`, `formatBytes` unchanged; confirm no other file imported `PLAN.monthlyCents` (grep; fix in Phase 11).

## Phase 2 — `plans.ts`: billingState → plan + effectivePlan + free status

- [x] 2.1 Extend `BillingStatus` union: add `"free"`; keep `trialing|active|past_due`; drop `read_only`/`locked` from the trial path (retain the literals only if suspended path still needs them — see 2.9).
- [x] 2.2 Add to `BillingState`: `plan: PlanId` (the stored plan) and `effectivePlan: PlanId` (what entitlements resolve from).
- [x] 2.3 `effectivePlan = "pro"` when status ∈ {trialing, active, past_due}; else `"free"`.
- [x] 2.4 Comped branch: `plan_override === "comped"` → status `active`, `effectivePlan "pro"`, `canWrite: !suspended`.
- [x] 2.5 Active/trialing subscription branch → status `active`, `effectivePlan "pro"`.
- [x] 2.6 Past-due subscription branch → status `past_due`, `canWrite: !suspended` (dunning, still writable), `effectivePlan "pro"`.
- [x] 2.7 Live 14-day trial (no sub) → status `trialing`, `trialDaysLeft`, `effectivePlan "pro"`.
- [x] 2.8 Fallthrough (no sub, no live trial, not comped) → status `free`, `canWrite: !suspended`, `effectivePlan "free"`, `publicLive: !suspended`. **No read-only, no lock.**
- [x] 2.9 Suspended remains the only hard `canWrite:false, publicLive:false` override, applied across all branches.
- [x] 2.10 Set `plan` on the returned state from `studio.plan` (coerced to `PlanId`, default `"free"`).
- [x] 2.11 Remove `graceEndsAt` lock computation from the free path; keep the field typed `Date | null` (null on free) to avoid churn in consumers.
- [x] 2.12 Update `StudioBillingFields` doc comment; no field additions needed (uses existing columns).

## Phase 3 — `plans.test.ts`: state + entitlements coverage

- [x] 3.1 Test `entitlements("free")` shape (cap set, maxSeats 1, payments+lightroom true, pro flags false).
- [x] 3.2 Test `entitlements("pro")` shape (uncapped, all true).
- [x] 3.3 Test billingState: live trial → `trialing`, effectivePlan `pro`, canWrite true.
- [x] 3.4 Test billingState: trial expired, no sub → `free`, effectivePlan `free`, canWrite true, publicLive true.
- [x] 3.5 Test billingState: active sub → `active`, effectivePlan `pro`.
- [x] 3.6 Test billingState: past_due → `past_due`, canWrite true.
- [x] 3.7 Test billingState: comped → `active`/pro regardless of trial.
- [x] 3.8 Test billingState: suspended forces canWrite false + publicLive false on each status.
- [x] 3.9 Test boundary: trial ends exactly now → `free`.
- [x] 3.10 Remove/replace old `read_only`/`locked` trial-path assertions.

## Phase 4 — Schema (`db/schema.sql`)

- [x] 4.1 Add idempotent migration block header "Revision 5 — Free + Pro per-seat".
- [x] 4.2 Drop the old `plan` default (`'studio'`).
- [x] 4.3 Drop any existing `plan` check constraint.
- [x] 4.4 `update studios set plan='pro' where subscription_status in ('active','trialing','past_due') or plan_override='comped'`.
- [x] 4.5 `update studios set plan='free' where plan not in ('free','pro')` (maps legacy `'studio'`).
- [x] 4.6 Set `plan` default `'free'`.
- [x] 4.7 Add check constraint `plan in ('free','pro')`.
- [x] 4.8 Confirm `storage_bytes` column exists (used by cap checks) — it does (`usage.refreshStorage`); no change.
- [x] 4.9 Leave `read_only_since`/`grace_ends_at` columns in place (still used by suspension); add a comment that the trial path no longer sets them.
- [ ] 4.10 Run `npm run db:migrate` twice against the preview Neon branch; confirm idempotent (no errors). *(deferred to Phase 16 verification — no local DATABASE_URL; shape validated by schema.test.)*
- [ ] 4.11 Note the schema change in `db/schema.sql` top comment / ARCHITECTURE table list (Phase 15).

## Phase 5 — Stripe setup + env (`scripts/stripe-setup.mjs`, `.env.example`, `env.ts`)

- [x] 5.1 `.env.example`: add `STRIPE_PRICE_PRO_SEAT_MONTHLY` with a one-line comment.
- [x] 5.2 `.env.example`: mark `STRIPE_PRICE_STUDIO_MONTHLY` deprecated (kept for old data), or remove if unused after Phase 11.
- [x] 5.3 `env.ts`: add `stripeProSeatPriceId: () => read("STRIPE_PRICE_PRO_SEAT_MONTHLY")`.
- [x] 5.4 `env.ts`: keep `stripe` configured flag unchanged.
- [x] 5.5 `stripe-setup.mjs`: create/find a `pro` product (metadata `app_plan:'pro'`, name `${appName} Pro`).
- [x] 5.6 `stripe-setup.mjs`: create per-seat price `unit_amount: 1800, recurring:{interval:'month'}, lookup_key:'pro_seat_monthly'` if missing.
- [x] 5.7 `stripe-setup.mjs`: print `STRIPE_PRICE_PRO_SEAT_MONTHLY=<id>`.
- [x] 5.8 `stripe-setup.mjs`: keep the immutable old `studio_monthly` price untouched; drop it from active creation.
- [x] 5.9 `stripe-setup.mjs`: leave referral coupon block unchanged.
- [ ] 5.10 Run `stripe-setup.mjs` against Stripe **test**; capture the printed price id. *(deferred — needs a Stripe test secret key.)*
- [ ] 5.11 Set `STRIPE_PRICE_PRO_SEAT_MONTHLY` in the preview Vercel env (test price). *(deferred — after 5.10.)*

## Phase 6 — `billing.ts`: per-seat checkout + seat sync

- [x] 6.1 Add `seatCount(studioId): Promise<number>` (`select count(*) from memberships`), min 1.
- [x] 6.2 `subscriptionPriceId()` → resolve `STRIPE_PRICE_PRO_SEAT_MONTHLY` (rename from studio price).
- [x] 6.3 `createSubscriptionCheckout`: set line item `quantity` = `seatCount(studio.id)` (was `1`).
- [x] 6.4 `createSubscriptionCheckout`: `subscription_data.description` = `${PLANS.pro.name} — per seat`.
- [x] 6.5 Add `adjustable_quantity` off (quantity is app-controlled) — confirm Checkout config.
- [x] 6.6 `subscriptionSnapshot`: on active/trialing/past_due, also set `plan='pro'`.
- [x] 6.7 `applySubscriptionDeleted`: set `plan='free'`, clear `stripe_subscription_id`, `subscription_status`, `current_period_end`, `cancel_at_period_end` (D1); do not set read_only/grace.
- [x] 6.8 Add `syncSeatQuantity(studio): Promise<void>` — fetch subscription, find the item, `stripe.subscriptions.update(subId,{ items:[{id, quantity}], proration_behavior:'create_prorations' })`.
- [x] 6.9 `syncSeatQuantity`: no-op when `subscription_status` ∉ {active,trialing,past_due} or no `stripe_subscription_id`.
- [x] 6.10 `syncSeatQuantity`: wrap Stripe errors, log via `logger`, never throw into the seat-change UI path (best-effort; cron reconciles).
- [x] 6.11 Add `reconcileSeatQuantities()` for the daily cron: for each Pro studio, ensure Stripe quantity == seatCount.
- [x] 6.12 Rename `markExpiredTrialsReadOnly` → `downgradeExpiredTrials` (body in Phase 7).
- [x] 6.13 Confirm `remainingTrialEnd`, `ensureCustomer`, `createPortalSession` unchanged.

## Phase 7 — Trial-end & cancellation → Free (cron + webhooks)

- [x] 7.1 `downgradeExpiredTrials()`: `update studios set plan='free', read_only_since=null, grace_ends_at=null where trial_ends_at < now() and subscription_status is null and plan_override is null and plan <> 'free'`.
- [x] 7.2 `api/cron/daily`: call `downgradeExpiredTrials()` (replace the read-only call).
- [x] 7.3 `api/cron/daily`: call `reconcileSeatQuantities()` (6.11).
- [x] 7.4 Remove the gallery-lock step (old 6.10) from the daily cron.
- [x] 7.5 Remove the trial-driven 90-day purge scheduling (old 6.12); keep purge only for explicit deletion (leave that path intact).
- [x] 7.6 Webhook `customer.subscription.deleted` → `applySubscriptionDeleted` sets `plan='free'` (verify path).
- [x] 7.7 Webhook `customer.subscription.updated` with terminal status (`canceled`/`unpaid` after dunning) → `plan='free'`.
- [x] 7.8 Webhook `invoice.payment_failed` → keep `past_due` (still Pro/writable) until Stripe cancels; no immediate downgrade.
- [x] 7.9 Confirm `invoice.paid` still clears any read-only and sets `plan='pro'`.
- [x] 7.10 Billing emails: "trial ends in 3 days" copy → "then your studio moves to the Free plan" (not read-only).
- [x] 7.11 Billing email "trial ended" → "you're now on Free — here's what changed" (list gated features).
- [x] 7.12 Remove/repoint the "galleries locked" purge-warning emails from the trial path.

## Phase 8 — `auth.ts`: entitlements in context + gate helper

- [x] 8.1 Extend the studio context type with `entitlements: Entitlements`.
- [x] 8.2 In `getStudioContext`, compute `entitlements(billing.effectivePlan)` and attach.
- [x] 8.3 Add `class UpgradeRequiredError extends Error` with `feature: keyof Entitlements` and a user message.
- [x] 8.4 Add `requireEntitlement(ctx, feature: keyof Entitlements)` — throws `UpgradeRequiredError` when the flag is false/`maxSeats` exceeded.
- [x] 8.5 Keep `requireWritableStudio` semantics (suspended-only hard gate now); confirm ~40 call sites still compile.
- [x] 8.6 Add `requireEntitledStudio(feature, minRole?)` convenience wrapper (writable + entitled) for server actions.
- [x] 8.7 Map `UpgradeRequiredError` in the server-action error boundary/`action-state` to a typed `{ upgrade: true, feature }` result.
- [x] 8.8 Impersonation path: platform admin viewing a studio still sees real entitlements (read-only already forced).

## Phase 9 — Gating enforcement (one sub-phase per feature)

Seats
- [x] 9.1 `team.inviteMember`: reject when `entitlements.maxSeats` is 1 and a second seat would result → typed "Upgrade to Pro to add teammates."
- [x] 9.2 `acceptInviteAction`: after insert, call `syncSeatQuantity(studio)`.
- [x] 9.3 `team.removeMember`: after delete, call `syncSeatQuantity(studio)`.
- [x] 9.4 `team.transferOwnership`: seat count unchanged, but call `syncSeatQuantity` if roles affect count (no-op guard).
- [ ] 9.5 Team settings UI: hide/disable invite form on Free with an inline "Upgrade to Pro" prompt.
- [ ] 9.6 Free downgrade with extra members (D4): non-owner members' `requireWritableStudio` returns a "studio on Free — ask owner to upgrade" reason for that studio; owner unaffected.
- [ ] 9.7 Team list shows "seat" badges and, on Pro, "each seat $18/mo".

Storage cap
- [x] 9.8 `photos.beginUpload`: read `getUsage().storageBytes` (or cached `storage_bytes`) and reject when `>= entitlements.storageBytes` (Free) with a clear message (D3).
- [x] 9.9 `storage.clientUploadToken`: same cap check before minting a client upload token.
- [ ] 9.10 Import path (Phase 21 feature) also respects the cap (belt-and-suspenders; import itself is Pro-gated in 9.16).
- [x] 9.11 Cap check helper `overStorageCap(studioId, entitlements)` in `usage.ts` (single source).
- [ ] 9.12 Uploader UI surfaces the cap message from the server (no client-only guess).
- [x] 9.13 Existing content stays served when over cap (no read gate) — verify gallery/asset reads are untouched.

Custom domain
- [x] 9.14 `settings/domain` add/verify actions: `requireEntitlement(customDomain)`.
- [x] 9.15 `proxy.ts` custom-domain lookup: treat a Free studio's custom domain as inactive (serve subdomain, do not 404 the subdomain).

Sending domain / email
- [x] 9.16 `sending-domains` create/verify actions: `requireEntitlement(sendingDomain)`.
- [x] 9.17 `email.senderFor(studio)`: when `!entitlements.sendingDomain`, force the platform default sender regardless of a stored verified domain.

Pro-only workflow features
- [x] 9.18 Automations: gate the automation-enable/run entry actions with `requireEntitlement(automations)`.
- [-] 9.19 Broadcasts: gate compose/send with `requireEntitlement(automations)`. *(no broadcast send action built yet — table/schema only; gate when built.)*
- [x] 9.20 Booking: gate booking-settings enable + public booking route with `requireEntitlement(booking)`.
- [x] 9.21 Import: gate `imports.createImport` with `requireEntitlement(imports)`.
- [x] 9.22 Session planning: gate `planning.*` mutations with `requireEntitlement(sessionPlanning)`.
- [x] 9.23 Referral reward: confirm `referrals.onFirstPaidInvoice` only fires for Pro (paid invoice) — add an explicit guard/test that Free never accrues.

Branding
- [x] 9.24 Gallery footer renders "Powered by {APP_NAME}" unless `entitlements.removeBranding`.
- [x] 9.25 Public site footer renders the badge unless `entitlements.removeBranding`.
- [x] 9.26 Badge links to the marketing site with the studio's `?ref=` referral code.

## Phase 10 — Sidebar / navigation gating (UI reveal)

- [ ] 10.1 Studio sidebar: mark Bookings, (Automations under Emails), Import as Pro; show a small "Pro" tag on Free.
- [ ] 10.2 Clicking a Pro-gated nav item on Free routes to the upgrade CTA (not a dead page).
- [x] 10.3 Website settings: custom-domain field shows a "Pro" lock on Free.
- [x] 10.4 Emails settings: sending-domain section shows a "Pro" lock on Free.
- [ ] 10.5 Session page: session-planning panel shows a "Pro" lock on Free.
- [x] 10.6 Reusable `<UpgradeLock feature=... />` component (message + upgrade button) used by 10.3–10.5 and 9.5.

## Phase 11 — Studio billing page + upgrade flow

- [x] 11.1 Fix all `PLAN` imports broken by Phase 1 (grep `from "@/lib/plans"`); switch to `PLANS`/`entitlements` as appropriate.
- [x] 11.2 Billing page: show current plan name + status badge (Trial N days / Pro active / Payment failed / Free).
- [x] 11.3 Free state: "Upgrade to Pro" CTA with a live `seats × $18 = $X/mo` preview.
- [x] 11.4 Trial state: "N days left of Pro, then Free" + Upgrade CTA.
- [x] 11.5 Pro state: seats, `seats × $18` monthly total, next invoice date, card on file, Manage/Cancel.
- [x] 11.6 Cancel copy: "Cancelling moves you to Free at period end. Your data stays." (D1).
- [x] 11.7 Usage panel: storage shown as `used / 5 GB` on Free (meter), "fair use" on Pro.
- [x] 11.8 Team members stat: shows seat count and, on Pro, the per-seat cost.
- [x] 11.9 `/api/billing/checkout`: unchanged entry, now yields per-seat quantity via 6.3.
- [x] 11.10 Upgrade CTA target: reuse `/api/billing/checkout` (owner/admin only) — no new route unless needed.
- [x] 11.11 Billing "what's included" switches to the effective plan's `highlights`.
- [x] 11.12 Success/return page copy: "You're on Pro" with seat count.

## Phase 12 — Marketing copy (two tiers)

- [ ] 12.1 `pricing/page.tsx`: replace "One plan" H1 with a two-tier headline.
- [ ] 12.2 Pricing: Free card (feature list, "Start free").
- [ ] 12.3 Pricing: Pro card ($18/seat/mo, feature list, "Start 14-day Pro trial").
- [ ] 12.4 Pricing: per-seat explainer ("pay only for the people on your team").
- [ ] 12.5 `sections.tsx` `PriceLine`: change "per studio, per month" to "$18 / seat / month" (or a two-tier component).
- [ ] 12.6 Home `page.tsx` pricing teaser: Free + Pro summary; update metadata description.
- [ ] 12.7 Home + pricing FAQ: rewrite the "How many people can log in / one price" answers for per-seat + Free.
- [ ] 12.8 `json-ld.tsx`: Offer(s) — Free (price 0) and Pro (price 18, unit per seat/month).
- [ ] 12.9 `legal-content.tsx` Terms §3: rewrite the pricing clause (Free + $18/seat, trial→Free).
- [ ] 12.10 `CompareTable`: add a Free column / adjust "Seats: Unlimited" to the new model.
- [ ] 12.11 `FinalCta` default lead copy: "Start free" primary.
- [ ] 12.12 Any `$40`/`monthlyCents` literal in marketing copy removed (grep).

## Phase 13 — Banners & notices

- [x] 13.1 Trial banner: "N days of Pro left — then your studio moves to Free" + Upgrade.
- [ ] 13.2 Turns amber at 3 days (keep existing threshold behavior).
- [-] 13.3 Free banner (dismissible): "You're on the Free plan — upgrade…". *(skipped: a persistent top-bar upsell nags on every page; the billing page + per-feature upgrade locks carry the upsell instead.)*
- [x] 13.4 Over-cap notice: "You've reached the 5 GB Free limit. Uploads are paused — upgrade or free up space."
- [ ] 13.5 Seats-locked notice for non-owner members on a downgraded Free studio (D4).
- [x] 13.6 Remove the old "read-only / galleries lock soon" banner from the trial path.

## Phase 14 — Tests

- [ ] 14.1 `billing`: checkout line item quantity == seatCount (mock Stripe).
- [ ] 14.2 `billing`: `syncSeatQuantity` no-ops on Free / no subscription.
- [ ] 14.3 `billing`: `syncSeatQuantity` updates quantity on active Pro (mock).
- [ ] 14.4 `billing`: `applySubscriptionDeleted` sets `plan='free'` and clears sub fields.
- [ ] 14.5 `cron`: `downgradeExpiredTrials` flips expired trial to Free, leaves paying studios alone.
- [ ] 14.6 gate: `requireEntitlement(customDomain)` throws on Free, passes on Pro.
- [ ] 14.7 gate: invite rejected on Free (`maxSeats` 1), allowed on Pro.
- [ ] 14.8 gate: `overStorageCap` true past 5 GB on Free, always false on Pro.
- [ ] 14.9 gate: `email.senderFor` returns platform sender on Free even with a stored domain.
- [ ] 14.10 referral: Free studio never triggers `onFirstPaidInvoice` reward.
- [ ] 14.11 entitlements snapshot test for both plans (guards accidental flips).
- [ ] 14.12 Full `npm test` green.

## Phase 15 — Docs & changelog

- [ ] 15.1 `ARCHITECTURE.md`: add a "Plans & entitlements" subsection (two tiers, effectivePlan, gate points).
- [x] 15.2 `SETUP.md`: Stripe section — create the `pro_seat_monthly` price, set `STRIPE_PRICE_PRO_SEAT_MONTHLY`.
- [x] 15.3 `SETUP.md`: note the per-seat quantity model and portal cancel → Free behavior.
- [x] 15.4 `BUILD-PLAN.md`: add a note that Revision 4's single-plan decision is superseded by this doc (link).
- [x] 15.5 `CHANGELOG.md`: one line per shipped phase.
- [ ] 15.6 Update `docs/INFRASTRUCTURE.md` cost model note if Free-tier storage assumptions change egress math.

## Phase 16 — Verification & rollout

- [ ] 16.1 `npm run typecheck && npm run lint && npm test` green in `saas/`.
- [ ] 16.2 `npm run build` green.
- [ ] 16.3 Apply schema to preview Neon; run `stripe-setup.mjs` on Stripe test; set preview env.
- [ ] 16.4 Preview: new studio → 14-day Pro trial, all features usable.
- [ ] 16.5 Preview: force `trial_ends_at` past + run daily cron → studio is Free, writable, Pro features locked, galleries live, over-cap upload blocked.
- [ ] 16.6 Preview: upgrade via Stripe test → checkout quantity == seat count; invite teammate → Stripe quantity bumps.
- [ ] 16.7 Preview: cancel via portal → downgrades to Free, data retained.
- [ ] 16.8 Preview: `/pricing` shows Free + Pro $18/seat and the two-tier compare.
- [ ] 16.9 Commit + push each phase; keep PR #11 CI green.
- [ ] 16.10 Update the PR description's pricing section.

---

**Honest item count:** ~150 atomic checkboxes across 16 phases (not literally 1000 — a
pricing change doesn't have 1000 genuinely distinct steps without padding). Each is small
and independently verifiable. If you want any single phase split finer (e.g. every one of
the ~40 gate call sites listed individually), say which and I'll expand it in place.
