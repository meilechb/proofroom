# Proofroom Store — complete concept & granular build plan

> Scope: the **full powerhouse** digital-sales feature for Proofroom, with every module and every capability mapped as one system (no v1/v2/v3 split). Physical-print (lab) selling is included as a complete module; it is sequenced last (phase S31) and can be toggled off without affecting the rest. This is the concept map **and** the granular, one-piece-at-a-time build plan (same convention as `BUILD-PLAN.md`); the phases below are built in order, each committed on its own with typecheck, lint and tests green. Legend: `[ ]` not started · `[x]` done · `[~]` partial · `[-]` dropped.

---

## Status — built so far (branch `claude/photographer-asset-sales-hg938i`, PR #19)

Shipped and green (typecheck + lint + 167 tests, each its own commit):
- **S1** schema/types/OwnedTable · **S2** Pro `store` entitlement · **S3** pricing/licence maths + catalog data layer
- **S4** store settings · **S5/S8** catalog admin (products with image picker, resolution×licence price rows, orders view)
- **S9** public `/shop` + product pages · **S11/S12** single-item buy → connected-account Stripe Checkout (0% commission)
- **S14** manual payment mode · **S15/S16** download grants + signed delivery route + buyer library and email link
- **S10** storefront favourites (cookie buyer key, heart toggle, favourites view) · **S18** discount codes · **S19** gift cards (issue/adjust in admin, redeem at checkout, sell as a product) · **S20 (partial)** whole-gallery unlock
- **S7** rights-managed licensing (usage matrix editor, live storefront price / "request a quote", server-recomputed RM price, usage recorded on the licence) · **S11** multi-item cart (localStorage cart, `/shop/cart`, add-to-cart, multi-line checkout with server-recomputed prices) · **S6 (partial)** price sheets (reusable presets, apply to a product) · **S17** buyer order history in the library (other orders, receipt + licence links) · **S24** refund/dispute handling (revokes downloads on full refund) · **S25 (partial)** sales analytics dashboard (revenue, AOV, top products/buyers) + orders view · **S27 (partial)** buyer licence / print-release document

Remaining phases: S6.4/S6.6 bundle tier config · S13 marketplace-collect + Stripe Tax · S20 bundles / pick-N selection UI · S21 digital products · S22 automations + broadcasts · S23 upsell · S25 full analytics · S26 embeds/distribution · S27 licence PDFs + email templates · S28 security review · S29 store cron (grant cleanup, abandoned cart) · S30 platform admin/metering · S31 physical prints / print lab · S32 marketing-site pages · S33 formal store test suite.

## 1. Context — why we're building this

Photographer sites carry two kinds of store: one that orders **physical prints** through a lab, and one that lets people **buy the images** (digital files + licenses). Proofroom gives every photographer a studio website, client galleries and payments — but no way to *sell* their work. This feature adds a complete store so a studio can turn its portfolio and client galleries into revenue: sell individual images, packages, whole-gallery unlocks, licenses, gift cards and prints — with the money going straight into the photographer's **own Stripe** (Proofroom's existing 0%-commission posture), watermark-until-paid delivery, and an automation engine that is the difference between a store nobody notices (~3% gallery→sale) and one that pays for the subscription (~8–12%).

Everything below is grounded in what already exists in `saas/`: Stripe Connect **direct charges** with no application fee (`src/lib/payments.ts`, `stripe.ts`, `connect.ts`), watermarking (`images.ts`), private-blob signed streaming (`api/photo/[id]`, `storage.ts`), tokenized no-login client links (`tenant-tokens.ts`), the fixed-schema **template site** (`studios.site`/`site_draft` jsonb validated by `lib/site/schema.ts` — the old block-based `site_pages` was removed), and the Packages CRUD as a template. The store is mostly assembly on top of these, plus new catalog/cart/licensing/delivery tables.

## 2. Locked decisions
- **Target app:** `saas/` (Proofroom), multi-tenant.
- **Full scope, unified:** per-image tiers + packages/bundles + whole-gallery unlock + gift cards + prints + delivery + buyer library + conversion engine + analytics — all in one map, decomposed into small pieces.
- **Licensing:** commercial from day one — personal/print-release **plus** royalty-free (RF) and rights-managed (RM), with per-sale license documents.
- **Plan gating:** the store is **Pro-only** — a single `store` entitlement gates admin + storefront; Free studios see an upgrade lock. Advanced marketing (automations/broadcasts) rides the same Pro entitlement.
- **Payments:** default is the photographer's **own connected Stripe, direct charge, 0% commission** (matches Proofroom today). A **marketplace-collect** mode (platform collects, takes commission, absorbs card fees, handles tax via Stripe Tax) and a **manual/offline** mode are included as selectable per-store payment modes.
- **RM pricing:** buyer selects a usage scope (media, circulation, duration, territory, exclusivity); price comes from a photographer-defined **matrix** with a **"request a quote"** fallback. A fully automated RM calculator is a later refinement inside the same module.

## 3. Non-negotiable conventions (followed by every piece)
- Every new table carries `studio_id`; every query filters by it; every mutation-by-id calls `assertOwned()` — and each new table is added to the `OwnedTable` union in `src/lib/auth.ts`.
- Money is integer **cents**; pricing math lives in a pure, unit-tested module (`store-shared.ts`) mirroring `orderMoney` in `src/lib/types.ts`; format with `formatMoney`.
- Schema changes are appended to `saas/db/schema.sql` as idempotent "Revision" blocks (no migrations folder); row types are hand-written in `src/lib/types.ts`; guarded by `tests/schema.test.ts`.
- Server data modules start with `import "server-only"`; server actions use Zod (`validation.ts`) + `action-state.ts` helpers + `ActionState` + `revalidatePath`; pages use `requireStudioPage` / actions use `requireWritableStudio` / paid features use `requireEntitledStudio("store")`.
- Read `node_modules/next/dist/docs/` before writing route/handler code (Next.js 16 has breaking changes: `params` is a Promise; typed `PageProps<...>`).
- Each numbered item is one small, verifiable piece (a column, a function, a UI state, a copy block, a test case), committed on its own with `typecheck`, `lint`, `test` green.

---

## 4. The complete concept — every module

### 4.1 Sellable sources (where for-sale images come from)
- Portfolio images (`portfolio_items` → `assets`, public store).
- Client-gallery photos (proof/final, `galleries`/`photos`, private store) — sell finals to the client and beyond.
- Curated **collections/sets** (a studio-defined group spanning galleries/portfolio).
- Non-image **digital products** (Lightroom presets, LUTs, profiles, e-books, templates, mobile presets) as downloadable files.
- Video / slideshow downloads (optional, same delivery rails).

### 4.2 Product types
- **Single image** with **resolution tiers** (web/social, standard ≤8×10, high-res original) and a **license** each.
- **Package / bundle**: pick-N from a set, fixed set, and **volume/tiered** pricing (per-image price falls as N rises).
- **Whole-gallery / whole-collection unlock** (one SKU, one ZIP) — highest-AOV digital SKU.
- **Gift cards / store credit** (face value, optional expiry, redeemable against anything).
- **Session vouchers / mini-session credits** (sell a future shoot credit).
- **Physical prints & wall art** (lab-fulfilled) and **print + digital combo packages** (module 4.13, sequenced last).
- **Digital-product downloads** (presets/e-books/etc.).

### 4.3 Licensing & rights engine
- Tiers: **personal / print-release** (default), **commercial royalty-free**, **commercial rights-managed**, **extended**, plus **editorial vs commercial** flag.
- RM usage scope: media type, circulation/impressions, duration, territory, exclusivity, industry.
- Per-SKU editable **license text**; **model/property release** attachment; watermark policy tied to license+resolution; auto-generated **license/print-release PDF** per purchased item (into `documents`); recorded license on every `sale_item` (buyer's proof of rights).

### 4.4 Pricing
- Per-image, per-resolution, per-license price; reusable **price sheets/presets** applied across many images/galleries; **volume/tier** discounts; **compare-at / sale** prices; **scheduled** price changes; studio **currency**; rounding rules; min/max pick; optional regional pricing; free "web share" tier toggle.

### 4.5 Storefront (public tenant surface)
- `/shop` landing, **collections**, **product detail** pages, gallery-embedded buy; watermarked preview lightbox; **favorites/wishlist**; search, filter, sort; "featured"/"new"; related products; social share; SEO metadata + product schema; mobile-first; accessible. Added as a fixed **shop page** on the template site (extend `lib/site/schema.ts` like `book`/`pricing`, not a block) plus dedicated routes under `t/[slug]/(site)/shop` and a buy flow under `t/[slug]/(app)`.

### 4.6 Cart & checkout
- Stateless cart (client-side/URL); **guest checkout** (email only) + optional buyer account; apply **coupon / gift card / store credit**; **wallet** (Apple/Google Pay via Stripe); tax display (Stripe Tax where applicable); order summary; license/terms acceptance; **abandoned-cart** capture.

### 4.7 Payments & payout modes
- **Connected direct-charge** (default, 0% commission) via `onAccount()`.
- **Marketplace-collect** (platform collects, application fee/commission, absorbs processing, Stripe Tax, payout to studio) — full alternative mode.
- **Manual/offline** (studio collects itself; instructions + optional payment link).
- Per-store mode toggle; fee model & payout visibility; multi-currency; refunds; disputes; receipts.

### 4.8 Fulfillment & delivery (digital)
- **Download grants** with signed, expiring URLs; **watermark-free originals** rendered/served only post-payment; per-resolution rendering; **ZIP bundling + split** for large orders; **download caps** (default 5 / 120h) with **reset**; email delivery; **buyer library** page (tokenized, no login); re-download windows; per-buyer **stamping/traceability**; digital-product file delivery.

### 4.9 Buyer experience & accounts
- Tokenized **library** (downloads, receipts, license docs, re-download, reset request); optional buyer **account** (order history across studios of that studio); notifications; support flow.

### 4.10 Conversion engine (rides existing automations/broadcasts)
- **Sales-automation presets**: favorite-frame (~7d), abandoned-cart (~24h), gallery-expiry reminder, holiday/gift-timing, birthday, re-engagement.
- **Broadcasts / campaigns**; **coupon** campaigns; **early-bird** & **scarcity/expiry**; **upsell/cross-sell** at cart (wall-art, complete-the-set, resolution upgrade); follow-up sequences; optional A/B.

### 4.11 Marketing & distribution
- Embeddable **buy button / storefront widget**; storefront on the studio's custom domain; **social sharing**; optional **affiliate/referral**; email capture; **Klaviyo/Mailchimp** export/segments; SEO landing pages.

### 4.12 Studio management & analytics
- Catalog admin; **orders/sales** management; refunds; payouts; **analytics** (product views, favorites, cart, conversion, revenue, AOV, top images/buyers); price sheets; license templates; **store settings** (currency, tax, delivery policy, watermark defaults, download caps, payment mode); gift-card & coupon management; notification settings.

### 4.13 Physical prints / print-lab (deferred track — sequenced last)
- Lab integration (e.g. Bay Photo / WHCC), print product catalog (sizes/finishes/frames), cost+markup pricing, shipping & tracking, print order routing, combo (print+digital) packages. *(Earlier flagged "skip for now"; included here as a complete module you can defer or drop.)*

### 4.14 Platform, compliance & security
- Entitlement gating (Pro-only) + fair-use; storage/bandwidth metering for delivery; platform metrics; abuse/fraud handling; marketplace-collect **tax liability**; **sales tax/VAT** (Stripe Tax); copyright & license enforcement; watermark integrity; signed URLs; rate limits; anti-scraping/anti-leak; **GDPR** (buyer PII, erasure); PCI (Stripe-hosted); audit logging; legal (terms, DPA, fair-use).

### 4.15 Ops
- Migrations/backfill; **feature flag** rollout; seed/sample data; **cron jobs** (abandoned-cart, expiry reminders, grant cleanup, payout/tax sync, variant regeneration); observability/logging (`logger.ts` + `redact`); error states; i18n-ready copy.

---

## 5. Complete data model (new tables → `saas/db/schema.sql`, types → `types.ts`, all added to `OwnedTable`)

- `store_settings` — per-studio store config (or extend `studios.settings` jsonb): currency, payment_mode (connected|marketplace|manual), tax_mode, watermark defaults, default download cap/window, delivery policy text, storefront on/off.
- `store_collections` — curated sets: `studio_id, slug, title, description, cover_asset_id, visibility, sort_order`.
- `store_collection_items` — membership: `collection_id, photo_id?/asset_id?, sort_order`.
- `store_products` — sellable item: `studio_id, kind (image|bundle|gallery_unlock|collection_unlock|gift_card|voucher|digital|print), source_asset_id?, photo_id?, gallery_id?, collection_id?, title, description, license_text, active, featured, sort_order, seo(jsonb)`.
- `product_prices` — priced options: `product_id, resolution (web|standard|original), license (personal|rf|rm|extended), amount_cents, compare_at_cents?, min_pick?, max_pick?, rm_matrix(jsonb)?, active`.
- `price_sheets` + `price_sheet_rows` — reusable pricing presets applied across products.
- `digital_products` / `digital_files` — non-image downloadable products and their files (private blob).
- `print_products` / `print_variants` — physical print catalog (deferred track).
- `sales` — a buyer purchase (the store "order"): `studio_id, buyer_email, buyer_name?, buyer_id?, subtotal_cents, discount_cents, tax_cents, total_cents, currency, status (pending|paid|failed|refunded|partially_refunded|disputed), payment_mode, stripe_account_id?, stripe_checkout_session_id (unique), stripe_payment_intent_id?, created_at`.
- `sale_items` — line items: `sale_id, product_id, photo_id?/asset_id?, resolution, license, usage_scope(jsonb, RM), qty, unit_amount_cents, amount_cents, license_document_id?`.
- `download_grants` — download rights: `sale_id, sale_item_id, photo_id?/file_id?, resolution, token_hash, expires_at, max_downloads, downloads_used, revoked`.
- `download_events` — audit/traceability: `grant_id, ip, ua, bytes, created_at`.
- `carts` (optional, for abandoned-cart recovery) — `studio_id, buyer_email?, items(jsonb), updated_at, recovered_at?` (or reconstruct from a client token; decide in build).
- `discount_codes` — `studio_id, code, kind (percent|fixed|free_ship), value, min_subtotal_cents?, product_scope?, gallery_scope?, starts_at?, ends_at?, max_uses?, uses, active`.
- `discount_redemptions` — one row per use.
- `gift_cards` — `studio_id, code_hash, code_last4, initial_cents, balance_cents, currency, expires_at?, active`; `gift_card_txns` — ledger.
- `store_favorites` — buyer favorites/wishlist (by client token / email): `studio_id, buyer_key, product_id/photo_id, created_at`.
- `store_events_daily` — aggregated store analytics (product views, favorites, add-to-cart, checkout, revenue), mirroring `analytics_daily`.
- `license_documents` — either a dedicated table or generated into the existing `documents` table; records the exact grant text/PDF per `sale_item`.
- (Reused: `documents`, `assets`, `portfolio_items`, `galleries`, `photos`, `payments`?/separate, `email_log`, `automation_sends`, `broadcasts`, `client_events`, `audit_log`, `stripe_events`.)

---

## 6. Build pieces

> Legend: `[ ]` not started · `[x]` done · `[~]` partial · `[-]` dropped. Items are numbered `phase.item(.sub)` and built in order unless a dependency is noted. This section is the review surface — each item is one small, independently committable piece. Finer sub-items are added as each phase is picked up (as in `BUILD-PLAN.md`). Phase list:

- **S0** Decisions, scope, feature flag, docs
- **S1** Schema & row types (all tables)
- **S2** Entitlements & Pro-only gating
- **S3** Core libraries: pricing/license math + data layer
- **S4** Store settings (studio)
- **S5** Catalog: mark-sellable, products, collections
- **S6** Pricing: price sheets, tiers, sale/scheduled prices
- **S7** Licensing engine (personal/RF/RM/extended) + license documents
- **S8** Studio admin: catalog & product management UI
- **S9** Storefront: shop, collections, product pages, SEO
- **S10** Favorites / wishlist
- **S11** Cart & checkout (guest, wallet, discounts, gift cards, tax)
- **S12** Payments: connected direct-charge
- **S13** Payments: marketplace-collect + Stripe Tax
- **S14** Payments: manual/offline mode
- **S15** Fulfillment: grants, watermark-free rendering, signed delivery
- **S16** Delivery: buyer library, ZIP/split, caps, resets, email
- **S17** Buyer accounts & order history
- **S18** Discounts & coupons
- **S19** Gift cards & store credit
- **S20** Bundles, volume pricing, gallery/collection unlock
- **S21** Digital products (presets/e-books/etc.)
- **S22** Conversion engine: sales automations & broadcasts
- **S23** Upsell / cross-sell
- **S24** Refunds, disputes, order management
- **S25** Analytics & reporting (studio)
- **S26** Marketing & distribution (embeds, social, integrations)
- **S27** Notifications & emails
- **S28** Security, anti-piracy, rate limits, GDPR, audit
- **S29** Cron jobs & background processing
- **S30** Platform admin, fair-use, metering
- **S31** Physical prints / print-lab (deferred track)
- **S32** Marketing site pages, help docs, changelog
- **S33** Testing, QA, launch checklist, rollout

_(The atomic numbered items for each phase are appended below.)_

### Phase S0 — Decisions, scope, flag, docs
- [ ] S0.1 Commit `saas/docs/STORE-PLAN.md` (this concept map) and `saas/docs/STORE-BUILD-PLAN.md` (this numbered list) as the working plan.
- [ ] S0.2 Record the settled decisions block (payment modes, commercial licensing, Pro-only, currency = `studio.currency`) at the top of the build-plan doc.
- [ ] S0.3 Add a `STORE_ENABLED` platform flag in `src/lib/env.ts` (+ `scripts/check-env.mjs`) so the whole feature ships dark and is turned on per environment.
- [ ] S0.4 Copy glossary: the user-facing nouns ("Store", "Shop", "For sale", "License", "Download", "Buyer") used consistently across admin, storefront and emails.
- [ ] S0.5 Legal stubs: selling addendum to Terms, fair-use note for delivery bandwidth, buyer-PII line in the DPA/Privacy pages.
- [ ] S0.6 `saas/CHANGELOG.md` entry stub for the store feature.
- [ ] S0.7 Add a top-level `docs/BUILD-PLAN.md` cross-reference so the store plan is discoverable next to the main plan.

### Phase S1 — Schema & row types
- [x] S1.1 Open a new "Revision — Store" block at the end of `saas/db/schema.sql` (idempotent, one statement per block, matching existing style).
- [x] S1.2 `store_collections` table (studio_id, slug unique-per-studio, title, description, cover_asset_id, visibility, sort_order, timestamps).
- [x] S1.3 `store_collection_items` table (collection_id, photo_id nullable, asset_id nullable, sort_order) + index.
- [x] S1.4 `store_products` table: id, studio_id, kind check-constraint (image|bundle|gallery_unlock|collection_unlock|gift_card|voucher|digital|print), source refs (asset_id?, photo_id?, gallery_id?, collection_id?), title, description, license_text, active, featured, sort_order, seo jsonb, timestamps.
- [x] S1.5 `store_products` indexes (studio_id+sort_order; kind; active) and uniqueness where needed.
- [x] S1.6 `product_prices` table: product_id, resolution check (web|standard|original), license check (personal|rf|rm|extended), amount_cents (>=0), compare_at_cents nullable, min_pick/max_pick nullable, rm_matrix jsonb nullable, active.
- [x] S1.7 `price_sheets` + `price_sheet_rows` tables (reusable presets) + FK/indexes.
- [x] S1.8 `sales` table: id, studio_id, order_number (per-studio sequence like orders), buyer_email, buyer_name, buyer_id nullable, subtotal_cents, discount_cents, tax_cents, total_cents, currency, status check (pending|paid|failed|refunded|partially_refunded|disputed), payment_mode check (connected|marketplace|manual), stripe_account_id, stripe_checkout_session_id unique, stripe_payment_intent_id, refunded_cents, timestamps.
- [x] S1.9 `sales` indexes (studio_id+created_at desc; buyer_email; stripe ids).
- [x] S1.10 `sale_items` table: sale_id, product_id, photo_id/asset_id refs, resolution, license, usage_scope jsonb, qty, unit_amount_cents, amount_cents, license_document_id nullable.
- [x] S1.11 `download_grants` table: sale_id, sale_item_id, photo_id/file_id, resolution, token_hash unique, expires_at, max_downloads (default 5), downloads_used (default 0), revoked bool, timestamps.
- [x] S1.12 `download_events` table (grant_id, ip, ua, bytes, created_at) + index for rate limiting/traceability.
- [x] S1.13 `discount_codes` table (studio_id, code unique-per-studio, kind, value, min_subtotal_cents, product/gallery scope, starts/ends, max_uses, uses, active) + `discount_redemptions`.
- [x] S1.14 `gift_cards` table (studio_id, code_hash unique, code_last4, initial_cents, balance_cents, currency, expires_at, active) + `gift_card_txns` ledger.
- [x] S1.15 `store_favorites` table (studio_id, buyer_key, product_id/photo_id, created_at) + unique index.
- [x] S1.16 `carts` table for abandoned-cart recovery (studio_id, buyer_email, items jsonb, updated_at, recovered_at) — or document the stateless-token alternative and pick one.
- [x] S1.17 `digital_products` + `digital_files` tables (non-image downloads; file lives in private blob).
- [x] S1.18 `print_products` + `print_variants` tables (deferred track; created now so the schema is complete, unused until S31).
- [x] S1.19 `store_events_daily` aggregate table (studio_id, day, product_id, metric, count/cents) mirroring `analytics_daily`.
- [x] S1.20 `store_settings` — decide: dedicated table vs keys under `studios.settings` jsonb; implement the chosen one (currency, payment_mode, tax_mode, watermark defaults, download cap/window, delivery policy, storefront on/off, print-lab creds).
- [x] S1.21 Row types for every table above in `src/lib/types.ts` (hand-written, dates as ISO strings), plus enums/label maps (resolution, license, sale status, payment_mode).
- [x] S1.22 Add every new table name to the `OwnedTable` union in `src/lib/auth.ts`.
- [x] S1.23 Extend `tests/schema.test.ts` to assert the new tables/columns exist and re-apply idempotently.
- [x] S1.24 `npm run db:migrate` against a scratch DB to confirm the block applies cleanly and is re-runnable.

### Phase S2 — Entitlements & Pro-only gating
- [ ] S2.1 Add `store: boolean` to the `Entitlements` type in `src/lib/plans.ts`.
- [ ] S2.2 Set `store: false` in `FREE_ENTITLEMENTS`, `store: true` in `PRO_ENTITLEMENTS`.
- [ ] S2.3 Add `storeMarketing: boolean` (automations/broadcasts/coupons-at-scale) — Pro-only — or fold into `store`; decide and document.
- [ ] S2.4 Gate every `/studio/store*` page with `requireEntitledStudio("store", "admin")`.
- [ ] S2.5 Gate every store server action with `requireEntitledStudio`/`requireEntitlement`, throwing `UpgradeRequiredError`.
- [ ] S2.6 Storefront visibility: a Free studio's `/shop` and store blocks 404/hide; buy affordances never render.
- [ ] S2.7 Upgrade-lock UI in the studio Store section reusing `src/components/studio/upgrade-lock.tsx`.
- [ ] S2.8 Nav: add a "Store" item to `src/components/studio/nav.tsx`, shown with an upgrade badge on Free.
- [ ] S2.9 Unit test: entitlement gate returns upgrade state on Free, passes on Pro/trial.

### Phase S3 — Core libraries (math + data layer)
- [ ] S3.1 Create `src/lib/store-shared.ts` (pure, no server-only imports; unit-testable like `booking-shared.ts`).
- [ ] S3.2 `lineItemTotal(price, resolution, license, qty)` — unit price selection.
- [ ] S3.3 `bundleTotal(items, priceRule)` — pick-N and volume/tier math (per-image price by count).
- [ ] S3.4 `applyDiscount(subtotal, code)` and `applyGiftCard(subtotal, card)` — pure reducers.
- [ ] S3.5 `rmPrice(usageScope, matrix)` — matrix lookup + null → "request a quote".
- [ ] S3.6 `cartTotals(cart, context)` — subtotal, discount, tax placeholder, total, all in cents.
- [ ] S3.7 Rounding/tabular money helpers; reuse `formatMoney`.
- [ ] S3.8 Unit tests for every function in S3 (mirroring `orderMoney` tests): pick-N, volume tiers, RF vs RM, discount stacking rules, gift-card partial, zero/negative guards.
- [ ] S3.9 Create `src/lib/store.ts` (`import "server-only"`) — data layer skeleton (studio-scoped query helpers).
- [ ] S3.10 CRUD: `listProducts/getProduct/createProduct/updateProduct/archiveProduct/reorderProducts` (slug uniqueness + `sort_order` via max()+1, mirroring `packages.ts`).
- [ ] S3.11 CRUD: collections and collection items.
- [ ] S3.12 CRUD: price sheets and rows; apply-sheet-to-products.
- [ ] S3.13 `markSellable(photoOrAsset, defaults)` / `unmarkSellable` — the fast path to create an image product from an existing gallery/portfolio image.
- [ ] S3.14 `createSale/getSale/listSales` + `sale_items` writers (single-statement CTEs where read-then-write must be atomic, per `db.ts` guidance).
- [ ] S3.15 `mintGrants(sale)` / `getGrant/consumeGrant/resetGrant/revokeGrant`.
- [ ] S3.16 `tenant.ts` helpers: `shopUrl(studio)`, `productUrl(studio, id)`, `libraryUrl(studio, token)`, `downloadUrl(grant)`.

### Phase S4 — Store settings (studio)
- [ ] S4.1 `getStoreSettings/updateStoreSettings` in `store.ts`.
- [ ] S4.2 Settings page `src/app/(studio)/studio/store/settings/page.tsx`.
- [ ] S4.3 Currency (read-only if tied to Stripe account) + display.
- [ ] S4.4 Payment mode selector (connected | marketplace | manual) with explanations and current Stripe status (`canTakeCardPayments`).
- [ ] S4.5 Default watermark on/off + text for for-sale previews.
- [ ] S4.6 Default download cap and expiry window.
- [ ] S4.7 Delivery/refund/license policy text fields.
- [ ] S4.8 Storefront on/off toggle + storefront path.
- [ ] S4.9 Tax mode (off | Stripe Tax when marketplace) + messaging about seller-of-record.
- [ ] S4.10 Zod schema `storeSettingsSchema` in `validation.ts`; action with `requireWritableStudio` + `requireEntitledStudio`.
- [ ] S4.11 Tests for settings validation and gating.

### Phase S5 — Catalog: mark-sellable, products, collections
- [ ] S5.1 "Sell this photo" affordance in the gallery admin (`studio/galleries`) → creates an `image` product with default prices.
- [ ] S5.2 "Sell" affordance in portfolio admin (`studio/portfolio`).
- [ ] S5.3 Bulk "mark sellable" across a gallery/collection with a chosen price sheet.
- [ ] S5.4 Product create/edit for each `kind` (image, bundle, gallery_unlock, collection_unlock, gift_card, voucher, digital, print).
- [ ] S5.5 Collection create/edit + add/remove items + reorder + cover image.
- [ ] S5.6 Product visibility/active/featured toggles; archive (never hard-delete when a sale references it).
- [ ] S5.7 SEO fields per product/collection (title, description, share image).
- [ ] S5.8 Validation schemas (`productSchema`, `collectionSchema`) + `fieldErrors`.
- [ ] S5.9 `recordClientEvent`/`audit_log` on product changes where useful.
- [ ] S5.10 Tests: product CRUD, slug uniqueness, cross-studio `assertOwned` rejection.

### Phase S6 — Pricing: sheets, tiers, sale & scheduled prices
- [x] S6.1 Price-sheet editor UI at `/studio/store/price-sheets` (name + rows of resolution × licence × amount) with a create/edit dialog reusing the product price-rows editor; `store.ts` CRUD (`listPriceSheetsWithRows`, `createPriceSheet`, `replacePriceSheetRows`, `deletePriceSheet`).
- [x] S6.2 Apply a sheet to a product (`applyPriceSheetToProduct` → `replaceProductPrices`) from a per-product "Apply sheet…" control on the store list. _(Apply-to-whole-gallery/collection: deferred with the bulk mark-sellable flow.)_
- [ ] S6.3 Per-product price override editor. _(Already covered by the product dialog's price rows.)_
- [ ] S6.4 Volume/tier pricing config for bundles (N ranges → per-image price) — with S20.
- [x] S6.5 Compare-at / sale price + optional scheduled start/end per price row (`effectivePrice`, unit-tested): inside the window the sale price is charged and the was-price struck through; outside it the regular price is charged. Computed at read time, so no cron flip is needed; `resolveStorePrice` uses it, storefront shows the strike-through and sale "from" prices.
- [ ] S6.6 Min/max pick config for pick-N bundles — with S20.
- [ ] S6.7 Free "web-share" tier toggle (share-size, watermarked, no print release).
- [ ] S6.8 Tests: sheet application, tier math via `store-shared`, scheduled-price transitions.

### Phase S7 — Licensing engine + license documents
- [x] S7.1 Per-price licence: personal / rf / rm / extended chosen per price row; editable per-product licence text; standard grant wording on the licence page.
- [x] S7.2 Licence attached to each price row (resolution × licence). _(Model/property-release attachment: future.)_
- [x] S7.3 RM usage-scope model (`RM_DIMENSIONS`: usage, term, territory) captured into `sale_items.usage_scope` at checkout (single + cart routes).
- [x] S7.4 RM matrix editor in the product dialog (tiers of usage/term/territory → price, "Any" = unpinned); `resolveStorePrice` prices from the matrix or returns `{quote:true}` → storefront shows "Request a quote". Price is recomputed server-side at both checkout routes.
- [x] S7.5 Watermark policy: the delivery route never serves the watermarked preview — web/standard are rendered clean, original passes through (done in S15.2). _(Per-licence watermark variance beyond that: future.)_
- [~] S7.6 The buyer licence page records the licence and, for RM, the exact permitted use (usage/term/territory) from `usage_scope`. _(A stored PDF in `documents` is the remaining S27.3 piece.)_
- [x] S7.7 Licence summary at point of sale: the buy form shows the licence per option and, for RM, live price or "priced on request" as the usage is chosen.
- [x] S7.8 Tests: `resolveStorePrice` (flat/rm-matrix/quote/flat-rm), `parseRmMatrix`, `cleanRmUsage`, `isCompleteRmUsage`, `rmPrice`.

### Phase S8 — Studio admin: catalog & product management UI
- [ ] S8.1 Add `{ href: "/studio/store", label: "Store", minRole: "admin" }` to the `items` array in `src/components/studio/nav.tsx` (Pro-badged on Free).
- [ ] S8.2 `/studio/store/page.tsx` (server): `requireStudioPage("admin")` → entitlement check → `UpgradeLock` on Free; else product list via `listProducts`, `PageHeader` + `EmptyState` + `DataTable`/card grid, money via `formatMoney(cents, studio.currency)`.
- [ ] S8.3 `store/actions.ts` (`"use server"`): `saveProductAction(_prev, formData)` mirroring `savePackageAction` (guard `requireEntitledStudio("store","admin")`, Zod parse via `str/cents/int/bool`, `fieldErrors`, mutate, `revalidatePath`).
- [ ] S8.4 `product-dialog.tsx` (client): `Dialog` + `useActionState` + `Field`/`MoneyField`/`Select` + `FormMessage` + `SubmitButton`; hidden `id` for edit.
- [ ] S8.5 Product price-rows editor within the dialog (resolution × license × amount; add/remove rows).
- [ ] S8.6 `archiveProductAction` / `reorderProductsAction` (plain FormData actions, re-guarded, soft-archive never delete).
- [ ] S8.7 "Sell this photo/gallery/portfolio image" entry points wired from `studio/galleries/[id]` and `studio/portfolio` → `markSellable`.
- [ ] S8.8 Bulk "mark sellable" with a chosen price sheet across a gallery/collection.
- [ ] S8.9 Collections manager (create/edit/reorder/cover) modeled on `portfolio-manager.tsx` typed-arg actions.
- [ ] S8.10 Image source picker reusing the website `image-picker.tsx`/asset library (avoid a new upload path for image products).
- [ ] S8.11 Sales list page `/studio/store/orders` (`DataTable`, `Badge` status, cursor `Pagination`, `SearchInput`).
- [ ] S8.12 Sale detail page (line items, buyer, license, downloads, refund/resend actions — see S24).
- [ ] S8.13 Add a cart/bag `Icon` to `src/components/ui/icons.tsx` (24-grid `Svg`) — no cart glyph exists today.
- [ ] S8.14 `productSchema`/`collectionSchema`/`priceRowSchema` in `validation.ts`; `store` schemas follow `z.coerce.number().int()` for cents.
- [ ] S8.15 Tests: product CRUD, price-row validation, cross-studio `assertOwned` rejection, entitlement gate.

### Phase S9 — Storefront (public template site)
- [ ] S9.1 Add `shopPageSchema` (enabled default false, heading, body, layout options) to `src/lib/site/schema.ts`; add to `siteSchema` + `SITE_PAGES`.
- [ ] S9.2 Add `shop` defaults in `src/lib/site/defaults.ts` so new studios get starter copy.
- [ ] S9.3 `publish.ts`: add `{ page:"shop", label:"Shop", path:"/shop", on: site.shop.enabled }` to `navPages`; add `"shop"` to the `button` target enum + `buttonHref` case so CTAs can point at the shop.
- [ ] S9.4 `render.ts` `loadSiteData`: load active store products/collections into `SiteData` (new query), alongside `packages`.
- [ ] S9.5 `ShopGrid` + `ProductCard` sections in `src/components/site/sections.tsx` modeled on `PackagesSection`, styled with `var(--site-*)` tokens, linking to the product/buy route.
- [ ] S9.6 Route `t/[slug]/(site)/shop/page.tsx` mirroring `pricing/page.tsx` (`studioBySlug` → `notFound` → `loadSiteData` → `page.enabled` → sections); `generateMetadata` from `site.seo`.
- [ ] S9.7 Product detail route `t/[slug]/(site)/shop/[productSlug]/page.tsx` (gallery of watermarked previews, resolution/license selector, price, add-to-cart).
- [ ] S9.8 Collection detail route `t/[slug]/(site)/shop/collection/[slug]/page.tsx`.
- [ ] S9.9 Watermarked previews served via the public `assets` store (for portfolio images) or a `preview`-signed `/api/photo/[id]` (for private gallery photos); never expose originals.
- [ ] S9.10 "Buy" affordances embedded inside the client gallery view (`t/[slug]/(app)/g/[gslug]`) for sellable gallery photos.
- [ ] S9.11 Search / filter / sort / "featured"/"new" on the shop grid; related products on product pages.
- [ ] S9.12 Product JSON-LD + Open Graph share images; social-share buttons.
- [ ] S9.13 Store view/beacon: `product_view`/`store_view` via `/api/track` (see S25).
- [ ] S9.14 Website editor: add a "Shop" toggle + panel to `website-editor.tsx` `PagesPanel` (enable page, heading/body, choose featured products/collections).
- [ ] S9.15 Tests: shop page renders only when enabled; disabled/Free studio 404s; nav includes Shop when on.

### Phase S10 — Favorites / wishlist
- [x] S10.1 `store_favorites` writers/readers in `store.ts` (`toggleFavorite`, `listFavoriteProductIds`, `listFavoriteProducts`) keyed by an anonymous cookie buyer key (`store-buyer.ts`: `readBuyerKey`/`ensureBuyerKey`).
- [x] S10.2 Heart toggle on shop cards and the product page (`FavoriteButton` server component + `toggleFavoriteAction`, progressively enhanced — works without JS).
- [x] S10.3 "Favourites" view at `/shop/favorites` + a count link from the shop header.
- [ ] S10.4 `track(studio, "favorite", productId)` — deferred to S25 store analytics.
- [ ] S10.5 Tests — deferred to the S33 store test suite; toggle idempotency is guarded by the `unique (studio_id, buyer_key, product_id)` index + `on conflict do nothing`.

### Phase S11 — Cart & checkout (guest, wallet, discounts, gift cards)
- [x] S11.1 Client-side cart in `localStorage`, scoped per studio slug (`cart-store.ts`), SSR-safe (loads after mount, cross-tab via a change event).
- [x] S11.2 Cart page `/shop/cart` (`CartView`): line items with remove, subtotal; "Add to cart" on the product page; a cart-count link in the shop header and product page.
- [x] S11.3 Discount code / gift card inputs on the cart, validated + recomputed server-side.
- [x] S11.4 Buyer email (guest) + optional name.
- [x] S11.5 Multi-item checkout `POST /api/store/cart-checkout`: rate-limited, gated, **every price recomputed from the catalogue** (client sends only selections), builds `sale`+`sale_items` and a multi-line Stripe session; gallery-unlock lines expand per photo; discount/gift collapse to a single summary line so the Stripe total equals the net charge; free (gift-covered) and manual paths handled.
- [x] S11.6 Wallets — automatic on Stripe-hosted Checkout.
- [x] S11.7 Success route clears the cart (`ClearCart`) on payment.
- [x] S11.8 Cancel returns to `/shop/cart?cancelled=1` with the cart intact. _(Server-side abandoned-cart persistence for recovery: with S22.)_
- [ ] S11.9 Tests: cart totals, discount+gift stacking, cross-studio guard, zero-total guards — with the S33 store test suite.

### Phase S12 — Payments: connected direct-charge (default mode)
- [ ] S12.1 `createStoreCheckout(studio, sale, buyer, urls)` in `payments.ts` mirroring `createOrderCheckout`: `mode:"payment"`, `line_items` from `sale_items` (`price_data.unit_amount` cents, `product_data.name`), `metadata:{ sale_id, studio_id, kind:"store" }`, `onAccount(studio.stripe_account_id)`, **no application fee**.
- [ ] S12.2 Gate with `canTakeCardPayments(studio)`; store hidden/blocked when Stripe not connected.
- [ ] S12.3 Insert/keep a pending `sales` row keyed by `stripe_checkout_session_id` (`on conflict do nothing`).
- [ ] S12.4 `defaultStoreUrls(studio, saleId)` (success `.../store/success?session_id={CHECKOUT_SESSION_ID}`, cancel `.../store/cancel`).
- [ ] S12.5 Webhook: extend `connect-webhook` `handle()` — branch on `session.metadata.kind==="store"` → `recordStoreCheckoutPaid(session, accountId)` (mark sale paid, mint grants S15, generate license docs S27, email buyer S27, `recordClientEvent("store.order_placed")`, notify studio S27). Idempotent via `stripe_events`.
- [ ] S12.6 Add `alter table stripe_events add column if not exists processed_at timestamptz;` (both webhook routes already write it; column is missing in schema).
- [ ] S12.7 `recordStoreRefund`/`recordStoreDispute` hooks (or reuse `recordRefund`/`recordDispute` keyed to the sale) — revoke grants on full refund (S24).
- [ ] S12.8 Tests: checkout session built on the connected account, no `application_fee`; webhook marks sale paid once (idempotency); metadata routing.

### Phase S13 — Payments: marketplace-collect mode + Stripe Tax
- [ ] S13.1 `store_settings.payment_mode = "marketplace"` path: charge on the **platform** account with `application_fee_amount` (commission) + `transfer_data.destination = studio account` (or destination charge), configurable commission %.
- [ ] S13.2 Enable `automatic_tax` + `tax_behavior` on the Checkout Session (Stripe Tax) when marketplace mode (platform is seller/facilitator of record).
- [ ] S13.3 Platform tax registration config + `store_settings.tax_mode`; buyer-facing tax line at checkout.
- [ ] S13.4 Payout visibility for the studio; fee breakdown (commission + processing) surfaced.
- [ ] S13.5 Webhook handling for platform-collected store sales (the platform `stripe/webhook` route, not connect) + payout reconciliation.
- [ ] S13.6 Seller-of-record & tax messaging in settings and receipts.
- [ ] S13.7 Tests: fee math, tax applied, destination transfer, mode toggle isolation.

### Phase S14 — Payments: manual / offline mode
- [ ] S14.1 `store_settings.payment_mode = "manual"`: show instructions + optional payment link instead of Checkout (mirror the order manual mode).
- [ ] S14.2 Sale recorded `pending`; studio marks paid → mint grants + deliver (reuse `recordManualPayment` shape).
- [ ] S14.3 Tests: manual sale lifecycle, grant issuance on manual mark-paid.

### Phase S15 — Fulfillment: grants, watermark-free rendering, signed delivery
- [x] S15.1 `mintGrants(sale)` — one `download_grant` per purchased photo/resolution with a hashed capability token, `expires_at` and `max_downloads` from settings (gift-card/voucher lines skipped).
- [x] S15.2 The delivered file is never watermarked: `original` → the private original; `web`/`standard` → `makeWebVersion(original, edge)` rendered clean on demand (the stored `preview_url` may be watermarked, so it is no longer served); portfolio assets are clean already. **Fixed during the S28 review — the route had been serving the watermarked preview for web/standard.**
- [x] S15.3 Delivery route `api/store/download/[grant]` verifies the grant (not revoked/expired, under cap) and streams with `Content-Disposition: attachment`.
- [x] S15.4 Decrements `downloads_used` and logs a `download_events` row (ip/ua/bytes) per successful download.
- [x] S15.5 `gallery_downloads.kind` widened to include `'purchase'`.
- [x] S15.6 Download route rate-limited (`store_download`); studio-scoped item/photo lookups.
- [ ] S15.7 Tests: grant expiry, cap enforcement, watermark-free output, tampered token rejected — with the S33 store test suite.

### Phase S16 — Delivery: buyer library, ZIP/split, caps, resets, email
- [ ] S16.1 Add `"download"` (library) `LinkKind` to `src/lib/tenant-tokens.ts` with a sensible TTL; `libraryUrl(studio, token)`.
- [ ] S16.2 Buyer library page `t/[slug]/(app)/library/[token]/page.tsx`: `verifyLink("download", token)` → sale(s) for that buyer; list items, downloads, receipts, license docs; re-download within window.
- [x] S16.3 Per-item download + "Download all (ZIP)" (`/api/store/library/[token]/zip` streams `zipStream` of every still-downloadable grant, files rendered lazily; `resolveGrantFile` shared with the single-download route). Each included grant counts as one download; capped/expired grants are skipped.
- [ ] S16.4 **ZIP splitting** for very large orders — a later refinement (the stream already avoids holding the order in memory).
- [x] S16.5 Recover-by-email: a `/library` page (and the expired-token state) lets a buyer who lost their delivery email get a fresh link to their latest order (`resendLibraryAction` re-mints `signLink`, no order enumeration, rate-limited).
- [ ] S16.6 `download_ready` email template + send from the webhook with the library link.
- [ ] S16.7 Tests: library link verify/expiry, ZIP contents, split threshold, reset flow.

### Phase S17 — Buyer accounts & order history
- [x] S17.1 Buyer identity via `clients` (dedupe on `(studio_id, lower(email))` via `createClient`) at checkout; the sale links to a client.
- [x] S17.2 Order history in the library (`listPaidSalesForBuyer`, scoped to the studio): a buyer's other orders cross-link to their own library page; each order shows its Stripe receipt (`receipt_url`) and licence (`signLink("license")`). Downloads and links stay available through a partial refund.
- [x] S17.3 Tokenised, no-login by default (per-sale `signLink("download")`); a lightweight password account is deferred.
- [ ] S17.4 Tests: buyer dedupe, history scoping to one studio, receipt/license access. _(covered by the checkout/fulfilment paths; formal store test suite is S33.)_

### Phase S18 — Discounts & coupons
- [ ] S18.1 `discount_codes` + `discount_redemptions` data layer in `store.ts`.
- [ ] S18.2 Reuse `referrals.ts` code helpers (`generateReferralCode`, `normalizeReferralCode`, `isReferralCodeShape`) for coupon codes.
- [ ] S18.3 Admin CRUD for codes (percent/fixed/free-ship, min subtotal, product/gallery scope, window, max uses).
- [ ] S18.4 Apply at cart via `store-shared.applyDiscount`; enforce window/`max_uses`/scope; write a redemption row (idempotent, `reward_queue`-style ledger).
- [ ] S18.5 Early-bird / scheduled sales (start/end); scarcity/expiry messaging.
- [ ] S18.6 Tests: code shape, discount math, max-uses race, scoped eligibility.

### Phase S19 — Gift cards & store credit
- [x] S19.1 `gift_cards` + `gift_card_txns` ledger; hashed codes (keyed `code_hash`, `code_last4`); issue/list/adjust/toggle + `spendGiftCard` (guarded, never below zero) + `recordSaleGiftCard` in `store.ts`.
- [x] S19.2 Sell a gift card (product `kind="gift_card"`): `issueSoldGiftCards` on paid (idempotent via `gift_cards.sale_item_id`), emails the code (`sendGiftCardEmail`); grants/library skip gift-card lines.
- [x] S19.3 Redeem at checkout (`findUsableGiftCard` + `giftCardSpend`): recorded on the sale, drawn down at fulfilment; a fully-covered order skips Stripe and settles straight to the library.
- [x] S19.4 Expiry + balance display; studio issue/adjust/deactivate in `/studio/store/gift-cards`.
- [x] S19.5 Tests: `normalizeGiftCode`; `giftCardSpend` (existing); schema guard for the new sale/gift columns.

### Phase S20 — Bundles, volume pricing, gallery/collection unlock
- [ ] S20.1 Product `kind="bundle"` with pick-N (`min_pick`/`max_pick`) selection UI on the storefront.
- [ ] S20.2 Volume/tier pricing via `store-shared.bundleTotal` (per-image price by count).
- [ ] S20.3 `kind="gallery_unlock"` / `"collection_unlock"` → one SKU that grants every photo (mint grants for all).
- [ ] S20.4 Reuse `photo_selections` for in-gallery "buy these N" where it fits.
- [ ] S20.5 Tests: pick-N bounds, tier boundaries, unlock grant set completeness.

### Phase S21 — Digital products (presets, e-books, etc.)
- [ ] S21.1 `digital_products` + `digital_files` tables; upload files via `Uploader` to the **private** blob store.
- [ ] S21.2 Product `kind="digital"`; delivery via grants (non-photo file passthrough, no watermark/rendering).
- [ ] S21.3 Admin UI to manage digital products & files.
- [ ] S21.4 Tests: digital delivery, file access gated by grant.

### Phase S22 — Conversion engine: sales automations & broadcasts (Pro)
- [ ] S22.1 Add store rules to `AUTOMATION_RULES` in `automations-shared.ts`: `favorite_frame`, `abandoned_cart`, `holiday_promo` (`gallery_expiring` already exists) with default timing/enabled.
- [x] S22.2 (abandoned checkout) `recoverAbandonedCheckouts` in the daily cron: a connected sale still `pending` a day after it started never completed at Stripe, so the buyer is nudged back to the shop once (idempotent via an `automation_sends` `store_abandoned` row; manual-mode pending sales excluded). Uses the pending sale as the data source, so no separate carts table is needed. _(favorite-frame/holiday rules still pending — they need buyer-email capture on favourites.)_
- [ ] S22.3 Template keys + defaults in `email-templates.ts`: `favorite_frame`, `abandoned_cart`, `order_confirmation`, `download_ready`, `license`, `store_receipt`; per-studio overrides via the `email_templates` table + editor.
- [ ] S22.4 Wire `sendAutomation` branches for the new rules (load entity, build vars, `sendStudioEmail`, `recordClientEvent`).
- [ ] S22.5 **Broadcasts (greenfield):** build `broadcasts.ts` + studio UI + a `sending` cron job; expand the `filter` jsonb to buyer/client segments; send via `sendStudioEmail` with an unsubscribe link (`signLink("unsub")`); per-recipient idempotency ledger.
- [ ] S22.6 Coupon campaigns / early-bird tie-in to broadcasts.
- [ ] S22.7 Gate all of S22 behind the Pro `store`/`storeMarketing` entitlement.
- [ ] S22.8 Tests: dueTargets windows, single-send idempotency, broadcast segment expansion, suppression respect.

### Phase S23 — Upsell / cross-sell
- [ ] S23.1 Cart upsell prompts (resolution upgrade, "complete the set", wall-art suggestion placeholder for S31) — with the multi-item cart.
- [x] S23.2 Related-product module on product pages ("More from the shop": `listRelatedProducts`, featured first). _(Post-purchase upsell email: with S22 automations.)_
- [ ] S23.3 Tests: upsell suggestion logic — with the S33 store test suite.

### Phase S24 — Refunds, disputes, order management
- [ ] S24.1 Studio sales list + detail with statuses; refund is issued in the studio's Stripe dashboard and mirrored via `charge.refunded` → `recordRefund` (extend to sales).
- [ ] S24.2 Revoke `download_grants` on full refund; keep on partial (configurable).
- [ ] S24.3 Dispute mirroring (`charge.dispute.*`) on sales; studio notification.
- [x] S24.4 Studio "Resend link" on each paid order (`resendSaleLibraryLink` → the delivery email) + manual mark-paid (manual mode). _(Cancel-a-pending-sale: minor, future.)_
- [ ] S24.5 Tests: refund→grant revocation, dispute state, resend.

### Phase S25 — Analytics & reporting (studio)
- [ ] S25.1 Extend `AnalyticsEvent` union with `store_view`, `product_view`, `cart_add`, `checkout_start`, `purchase`; call `track()` at each point; add a store branch to `/api/track`. _(View/favourite/conversion counts still pending — needs the beacon.)_
- [x] S25.2 Store dashboard `/studio/store/analytics` (`storeAnalytics` + `Stat` cards + top-products/top-buyers lists): net & gross revenue, orders, AOV, items sold, gift-card balance outstanding.
- [x] S25.3 Revenue/AOV/top lists computed from `sales`/`sale_items` (gift-card/voucher lines excluded from item counts). _(View-based conversion awaits S25.1.)_
- [ ] S25.4 Tests: aggregation correctness, conversion math — with the S33 store test suite.

### Phase S26 — Marketing & distribution
- [x] S26.1 Embeddable "buy" button / shop link: a "Share & embed" panel on store settings gives the shop URL and a copyable, self-contained HTML button snippet (no script, works on any site builder) that deep-links into the tenant shop.
- [ ] S26.2 Social sharing + SEO landing for products/collections (works on custom domains via existing tenant routing).
- [ ] S26.3 Buyer export + Klaviyo/Mailchimp segment hooks (optional).
- [ ] S26.4 Optional affiliate/referral for store sales (reuse referral primitives).
- [ ] S26.5 Tests: widget deep-link, export shape.

### Phase S27 — Notifications & emails
- [x] S27.1 Studio alert on a paid store sale (owner email via `notifyStudio` in the connect webhook), plus refund and dispute alerts. _(A $0 gift-card-covered order deliberately skips the "new sale" notice — no new money moved.)_
- [~] S27.2 Buyer emails: delivery/library link on paid (`sendStoreDeliveryEmail`), gift-card codes (`sendGiftCardEmail`), and the printable licence page are done; dedicated `order_confirmation`/`store_receipt`/refund templates + per-studio overrides remain.
- [ ] S27.3 License/print-release document generator: render per `sale_item` (Markdown-template like `agreements.ts`, or an HTML print-view like invoice/receipt) → upload to private blob via `storage.ts` → `insert into documents (kind:'license', …)`; add `'license'` to the `documents.kind` CHECK and a `'license'` `LinkKind`.
- [ ] S27.4 Tests: email sends & suppression, license-doc generation & access.

### Phase S28 — Security, anti-piracy, rate limits, GDPR, audit
- [ ] S28.1 Signed, expiring download URLs + hashed grant tokens; never expose originals on a public path.
- [ ] S28.2 Download caps + rate limits (`limited(...)`) on delivery and checkout; anti-scraping on previews.
- [ ] S28.3 Optional per-buyer stamping / EXIF tagging for leak tracing (`download_events` already logs ip/ua).
- [ ] S28.4 `audit_log` entries on catalog/price/coupon/refund changes.
- [ ] S28.5 GDPR: buyer PII erasure across `clients`/`sales`/`sale_items`/`download_events`; `mergeClients` re-parents new store tables.
- [ ] S28.6 PCI: all card data stays on Stripe-hosted Checkout; no card fields in our UI.
- [~] S28.7 Security review of the store diff (in progress). Found + fixed: the download route served the **watermarked** `preview_url` for web/standard tiers, so a paid buyer of those tiers on a watermarked gallery got a watermarked file — now rendered clean from the original on demand (S15.2). Confirmed sound: multi-tenant `studio_id` scoping on every store query, server-side price recomputation at both checkout routes (client never supplies amounts), hashed grant/gift-card tokens, guarded gift-card draw-down.
- [ ] S28.8 Tests: unauthorized download blocked, rate-limit trips, erasure completeness.

### Phase S29 — Cron jobs & background processing
- [ ] S29.1 Abandoned-cart handled as a `runAutomations` preset (daily) or a dedicated `frequent` job for hour-scale timing.
- [x] S29.2 Daily sweep (`cleanupStore`): prune old `download_events`, delete long-dead revoked `download_grants`, clear abandoned never-recovered carts (live-but-expired grants kept so the library shows an "expired" state).
- [ ] S29.3 Scheduled sale-price flips (daily job reads `product_prices` windows) — with S6.5.
- [ ] S29.4 Payout/tax status sync (`frequent` job) for marketplace mode — with S13.
- [ ] S29.5 **Watermark-variant regeneration job** (build): when a studio toggles for-sale watermark defaults, regenerate affected previews (no such job exists today).
- [ ] S29.6 Orphan-blob cleanup + `refreshStorageCounters` include store/digital files — with S21.
- [x] S29.7 `cleanupStore` registered in the daily `runJobs({...})`; idempotent by construction.
- [ ] S29.8 Tests: grant cleanup, price-flip transitions, regeneration idempotency.

### Phase S30 — Platform admin, fair-use, metering
- [x] S30.1 Platform admin store metrics on `/admin/metrics`: store GMV (all studios, 0% commission), order count, number of selling studios, and outstanding gift-card liability (added to `platformMetrics`).
- [ ] S30.2 Delivery storage/bandwidth metering via `usage.ts`; fair-use surfacing.
- [ ] S30.3 Abuse/fraud handling; marketplace-collect tax-liability config; platform digest includes store activity.
- [ ] S30.4 Tests: metering counts, admin scoping.

### Phase S31 — Physical prints / print-lab (deferred track — sequenced last)
- [ ] S31.1 `print_products` + `print_variants` catalog (sizes/finishes/frames) admin UI.
- [ ] S31.2 Lab integration client (e.g. Bay Photo / WHCC): product sync, order submission, status/tracking webhooks.
- [ ] S31.3 Cost + markup pricing; shipping address capture at checkout; shipping/tax handling.
- [ ] S31.4 Print SKU in the same cart; print+digital combo packages.
- [ ] S31.5 Fulfillment status surfaced to buyer (library) and studio (orders).
- [ ] S31.6 Tests: lab order submission, status sync, combo pricing. *(Earlier flagged "skip for now" — build last or defer.)*

### Phase S32 — Marketing site, help docs, changelog
- [x] S32.1 Marketing feature page `/features/store` (added to `features-content.ts`, cross-linked from Payments): sell photos/licences/gift cards, 0% commission, watermark-until-paid delivery, buyer library.
- [x] S32.2 `features-content.ts`, the pricing comparison table and an FAQ now carry the Pro-store & 0%-commission story.
- [ ] S32.3 Help docs / setup runbook (connect Stripe, mark sellable, set licenses, delivery policy).
- [x] S32.4 `CHANGELOG.md` "Unreleased" entry for the store.

### Phase S33 — Testing, QA, launch checklist, rollout
- [ ] S33.1 Unit: all `store-shared` math (bundles, discounts, gift cards, RM), license resolver, grant cap/expiry.
- [ ] S33.2 Integration: cart → checkout → connect-webhook → grants → download, end to end (each payment mode).
- [ ] S33.3 E2E in Stripe test mode with `stripe listen --forward-connect-to .../connect-webhook` and `stripe trigger`.
- [ ] S33.4 Cross-studio isolation tests on every store table/route.
- [ ] S33.5 Load test large-gallery ZIP + split delivery.
- [ ] S33.6 `security-review` pass; schema guard test updated; `npx next typegen && npm run typecheck && npm run lint && npm test && npm run build` all green.
- [ ] S33.7 Feature-flag staged rollout (`STORE_ENABLED`), seed/sample data, launch checklist, then flip on.

---

## 7. Verification & rollout
- **Per piece:** every numbered item is committed on its own with `npx next typegen && npm run typecheck`, `npm run lint`, and `npm test` green; schema changes re-apply idempotently via `npm run build`.
- **Money & delivery correctness** get pure unit tests (mirroring `orderMoney` tests) plus an integration test through the real connect-webhook path.
- **End-to-end (Stripe test mode):** connect a test studio account; mark an image sellable with personal + RF + RM prices; buy via Checkout with a test card; forward the connected webhook; confirm the sale flips to paid, the buyer gets the library link, the signed download returns the **watermark-free** file at the purchased resolution, the license document is generated, and the download cap decrements and resets. Verify a Free studio sees the upgrade lock and the storefront is hidden.
- **Rollout:** ship dark behind `STORE_ENABLED`, enable per environment, then per studio; the deferred print-lab track (S31) can be sequenced last or dropped without affecting the digital store.

> Scale note: this lists ~360 atomic items across 34 phases; as each phase is picked up its items expand into finer `.1/.2` sub-items (as in `BUILD-PLAN.md`, e.g. `6.5.1`), reaching the ~1,000-piece granularity for one-at-a-time review and build.

