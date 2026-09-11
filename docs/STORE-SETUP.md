# Store setup runbook

How a studio turns its work into a shop. The store is **Pro-only**; a Free
studio sees an upgrade lock and its `/shop` 404s. Money goes to the studio's
**own Stripe at 0% commission** (or a manual/offline mode).

## 1. Connect Stripe (to take card payments)

1. **Settings → Payments** — connect the studio's Stripe account (the same
   connection used for session payments). Until it's connected, the store can
   still be built but "Buy" is blocked with a clear message.
2. Card wallets (Apple/Google Pay) come free on Stripe-hosted Checkout — no
   extra setup.
3. No Stripe? Use **manual/offline** mode (below) to collect payment yourself.

## 2. Open the store

**Studio → Store → Settings**:

- **Storefront on/off** — turns `/shop` on.
- **Payment mode** — *connected* (default, your Stripe), *manual* (you collect
  and mark paid), or *marketplace* (mapped, not yet live).
- **Watermark** default and text for for-sale previews.
- **Download cap** (default 5) and **window** (hours) for each purchased file.
- **Delivery / refund policy** text shown to buyers.

The **Share & embed** panel gives the shop link and a paste-anywhere HTML buy
button. Each product also has its own **Embed** dialog.

## 3. Add something to sell

**Studio → Store → Add product**. Pick what you're selling:

- **A single image** — choose the image, then add price rows.
- **A whole gallery (unlock)** — one SKU that grants every photo in a gallery.
- **A whole collection (unlock)** — build a set under **Collections** first
  (curate library/portfolio images), then sell it as one unlock.
- **A pick-any bundle** — the buyer picks N photos from a gallery at a per-photo
  price; add **volume tiers** ("from N photos, each $X") to drop the price as
  they pick more.
- **A digital file** (preset, LUT, e-book) — save the product, then use its
  **Files** dialog to upload the downloads (they land in the private store and
  reach buyers only through a paid link).

Each product carries one or more **price rows**: resolution (web / standard /
original) × licence, with an optional **compare-at / sale** price and schedule.
Reuse a **price sheet** to apply the same rows across many products.

## 4. Set the licence

Each price row has a licence:

- **Personal / print release** — personal use only.
- **Royalty-free (RF)** — commercial, at the purchased resolution.
- **Rights-managed (RM)** — the buyer picks a usage scope (usage / term /
  territory); the price comes from a **matrix** you define, with a
  "request a quote" fallback for combinations you haven't priced.
- **Extended** — as agreed with the studio.

Add **Licence / print-release text** per product; it shows to the buyer and is
recorded on their printable licence.

## 5. Delivery

On payment the buyer gets a **no-login library** link (emailed and on a signed
URL) with per-file downloads, a "Download all (ZIP)", their receipt and a
printable licence. Files are **watermark-free**: originals stream from the
private store; web/standard tiers are rendered clean on demand. Downloads are
capped and time-boxed per the settings; an expired link can be re-fetched by
email.

## 6. Manual / offline mode

Set **payment mode = manual**. The buyer is shown your instructions instead of
Stripe; the sale sits **pending** until you open it under **Store → Orders** and
**mark it paid**, which mints the download grants and emails the library link.

## 7. Discounts, gift cards, promotions

- **Discounts** — percent or fixed codes, min-subtotal and max-uses; applied at
  checkout against the order subtotal.
- **Gift cards** — issue in admin or sell one as a product; redeemed at
  checkout (partial spend draws the balance down; a fully-covered order skips
  Stripe entirely).

## 8. See how it's doing

**Store → Analytics**: revenue, average order value, items sold, top products
and buyers, plus a **Last 30 days** funnel — shop views, product views, cart
adds, checkouts, purchases and the conversion rate. Storefront view/cart
beacons respect Do Not Track and store no cookie or identifier.

## Notes for operators

- Every store table carries `studio_id`; every query and mutation is
  studio-scoped.
- Prices are **recomputed server-side** at checkout — the client only sends
  selections, never trusted amounts.
- Digital files and purchased files live in the **private** blob store; the
  orphan-blob sweep and storage metering both account for them.
- The feature ships behind the `store` Pro entitlement; see
  `docs/STORE-BUILD-PLAN.md` for the full build map.
