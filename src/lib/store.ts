import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { db, one, rows } from "@/lib/db";
import { assertOwned } from "@/lib/auth";
import { normalizeSlug } from "@/lib/slug";
import { hmac } from "@/lib/tokens";
import { requireEnv } from "@/lib/env";
import { formatMoney } from "@/lib/types";
import { digitalExtOk, MAX_DIGITAL_BYTES, normalizeGiftCode, storeSettings, type RmMatrixRow, type VolumeTier } from "@/lib/store-shared";
import { signLink } from "@/lib/tenant-tokens";
import { shopUrl, storeLibraryUrl } from "@/lib/tenant";
import { clientUploadToken, deleteBlobs, digitalPath, safeFilename } from "@/lib/storage";
import { addBytes, assertUnderStorageCap } from "@/lib/usage";
import { sendGiftCardEmail, sendStoreAbandonedEmail, sendStoreDeliveryEmail } from "@/lib/emails/studio";
import { track } from "@/lib/analytics";
import type {
  DigitalFile,
  DiscountCode,
  DownloadGrant,
  GiftCard,
  GiftCardTxn,
  PriceSheet,
  PriceSheetRow,
  ProductPrice,
  Sale,
  SaleItem,
  SaleStatus,
  StoreCollection,
  StoreCollectionItem,
  StoreLicense,
  StorePaymentMode,
  StoreProduct,
  StoreProductKind,
  StoreResolution,
} from "@/lib/types";

/**
 * Store catalog data layer (studio-scoped). Mirrors packages.ts conventions:
 * slug uniqued per studio, sort_order via max()+1, products archived not
 * deleted (sales reference them). Pricing/licence maths live in store-shared.ts.
 */

export type ProductInput = {
  kind: StoreProductKind;
  title: string;
  description?: string | null;
  assetId?: string | null;
  photoId?: string | null;
  galleryId?: string | null;
  collectionId?: string | null;
  licenseText?: string | null;
  isActive?: boolean;
  isFeatured?: boolean;
};

export type ProductPriceInput = {
  resolution: StoreResolution;
  license: StoreLicense;
  amountCents: number;
  compareAtCents?: number | null;
  minPick?: number | null;
  maxPick?: number | null;
  rmMatrix?: RmMatrixRow[] | null;
  volumeTiers?: VolumeTier[] | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
};

async function uniqueProductSlug(studioId: string, base: string) {
  const root = normalizeSlug(base) || "item";
  let slug = root;
  for (let i = 2; (await db()`select 1 from store_products where studio_id = ${studioId} and slug = ${slug}`).length > 0; i++) slug = `${root}-${i}`;
  return slug;
}

// --- Products ---------------------------------------------------------------

export async function listProducts(studioId: string, opts: { activeOnly?: boolean } = {}) {
  return rows<StoreProduct>(
    opts.activeOnly
      ? await db()`select * from store_products where studio_id = ${studioId} and is_active order by sort_order, created_at`
      : await db()`select * from store_products where studio_id = ${studioId} order by sort_order, created_at`
  );
}

export async function getProduct(studioId: string, id: string) {
  return one<StoreProduct>(await db()`select * from store_products where id = ${id} and studio_id = ${studioId}`);
}

export async function getProductBySlug(studioId: string, slug: string) {
  return one<StoreProduct>(await db()`select * from store_products where slug = ${slug} and studio_id = ${studioId}`);
}

/** Sellable photos of a gallery (for a pick-any bundle's picker). */
export async function listSellablePhotos(studioId: string, galleryId: string) {
  return rows<{ id: string; filename: string }>(
    await db()`select id, filename from photos where gallery_id = ${galleryId} and studio_id = ${studioId} and deleted_at is null and preview_url <> '' and preview_url not like 'pending:%' order by sort_order, created_at`
  );
}

/** Active, priced products with a "from" price and thumbnail, for cross-sell modules (S23). */
export async function listShopHighlights(studioId: string, limit = 4, excludeId: string | null = null) {
  return rows<{ id: string; slug: string; title: string; from: number; thumb_url: string | null; web_url: string | null; url: string | null }>(
    await db()`
      select p.id, p.slug, p.title,
        (select min(amount_cents) from product_prices pr where pr.product_id = p.id and pr.is_active and pr.amount_cents > 0) as from,
        a.thumb_url, a.web_url, a.url
      from store_products p left join assets a on a.id = p.asset_id
      where p.studio_id = ${studioId} and p.is_active
        and (${excludeId}::uuid is null or p.id <> ${excludeId})
        and p.kind in ('image', 'bundle', 'gallery_unlock', 'collection_unlock', 'digital')
        and exists (select 1 from product_prices pr where pr.product_id = p.id and pr.is_active and pr.amount_cents > 0)
      order by p.is_featured desc, p.sort_order, p.created_at limit ${limit}`
  ).map((r) => ({ id: r.id, slug: r.slug, title: r.title, from: r.from, img: r.thumb_url ?? r.web_url ?? r.url }));
}

/** The active gallery-unlock or bundle product selling a gallery, for an in-gallery "buy" CTA (S9.10). */
export async function getGalleryStoreProduct(studioId: string, galleryId: string) {
  return one<StoreProduct>(
    await db()`select * from store_products where studio_id = ${studioId} and gallery_id = ${galleryId} and kind in ('gallery_unlock', 'bundle') and is_active
      order by case kind when 'gallery_unlock' then 0 else 1 end, created_at limit 1`
  );
}

/** A few other active, sellable products for the "more from the shop" module. */
export async function listRelatedProducts(studioId: string, excludeId: string, limit = 4) {
  return rows<StoreProduct>(
    await db()`select * from store_products
      where studio_id = ${studioId} and is_active and id <> ${excludeId}
        and kind in ('image', 'bundle', 'gallery_unlock', 'collection_unlock', 'digital')
      order by is_featured desc, sort_order, created_at limit ${limit}`
  );
}

export async function createProduct(studioId: string, input: ProductInput) {
  const slug = await uniqueProductSlug(studioId, input.title);
  const next = one<{ n: number }>(await db()`select coalesce(max(sort_order), 0) + 1 as n from store_products where studio_id = ${studioId}`);
  return one<StoreProduct>(
    await db()`
      insert into store_products (studio_id, kind, slug, title, description, asset_id, photo_id, gallery_id, collection_id, license_text, is_active, is_featured, sort_order)
      values (${studioId}, ${input.kind}, ${slug}, ${input.title.trim()}, ${input.description ?? null}, ${input.assetId ?? null}, ${input.photoId ?? null}, ${input.galleryId ?? null}, ${input.collectionId ?? null}, ${input.licenseText ?? null}, ${input.isActive ?? true}, ${input.isFeatured ?? false}, ${next?.n ?? 1})
      returning *`
  );
}

export async function updateProduct(studioId: string, id: string, input: Partial<ProductInput>) {
  const current = await getProduct(studioId, id);
  if (!current) throw new Error("Not found");
  return one<StoreProduct>(
    await db()`
      update store_products set
        title = ${input.title?.trim() ?? current.title},
        description = ${input.description === undefined ? current.description : input.description},
        license_text = ${input.licenseText === undefined ? current.license_text : input.licenseText},
        is_active = ${input.isActive ?? current.is_active},
        is_featured = ${input.isFeatured ?? current.is_featured}
      where id = ${id} and studio_id = ${studioId}
      returning *`
  );
}

/** Products are archived, never deleted, because sales reference them. */
export async function archiveProduct(studioId: string, id: string) {
  return one<StoreProduct>(await db()`update store_products set is_active = false where id = ${id} and studio_id = ${studioId} returning *`);
}

export async function reorderProducts(studioId: string, orderedIds: string[]) {
  let i = 1;
  for (const id of orderedIds) await db()`update store_products set sort_order = ${i++} where id = ${id} and studio_id = ${studioId}`;
}

// --- Prices -----------------------------------------------------------------

export async function listProductPrices(studioId: string, productId: string) {
  return rows<ProductPrice>(await db()`select * from product_prices where studio_id = ${studioId} and product_id = ${productId} order by sort_order, created_at`);
}

/** Replace the full set of price rows on a product (the admin edits them together). */
export async function replaceProductPrices(studioId: string, productId: string, priceRows: ProductPriceInput[]) {
  const owned = await getProduct(studioId, productId);
  if (!owned) throw new Error("Not found");
  await db()`delete from product_prices where studio_id = ${studioId} and product_id = ${productId}`;
  let i = 0;
  for (const r of priceRows) {
    await db()`
      insert into product_prices (studio_id, product_id, resolution, license, amount_cents, compare_at_cents, min_pick, max_pick, rm_matrix, volume_tiers, sale_starts_at, sale_ends_at, sort_order)
      values (${studioId}, ${productId}, ${r.resolution}, ${r.license}, ${r.amountCents}, ${r.compareAtCents ?? null}, ${r.minPick ?? null}, ${r.maxPick ?? null}, ${r.rmMatrix && r.rmMatrix.length ? JSON.stringify(r.rmMatrix) : null}, ${r.volumeTiers && r.volumeTiers.length ? JSON.stringify(r.volumeTiers) : null}, ${r.saleStartsAt ?? null}, ${r.saleEndsAt ?? null}, ${i++})`;
  }
  return listProductPrices(studioId, productId);
}

// --- Price sheets (reusable pricing presets) --------------------------------

export async function listPriceSheets(studioId: string) {
  return rows<PriceSheet>(await db()`select * from price_sheets where studio_id = ${studioId} order by name`);
}

export async function listPriceSheetRows(studioId: string, sheetId: string) {
  return rows<PriceSheetRow>(await db()`select * from price_sheet_rows where studio_id = ${studioId} and sheet_id = ${sheetId} order by sort_order, created_at`);
}

/** All sheets with their rows, for the admin list and the product prefill. */
export async function listPriceSheetsWithRows(studioId: string) {
  const sheets = await listPriceSheets(studioId);
  return Promise.all(sheets.map(async (s) => ({ sheet: s, rows: await listPriceSheetRows(studioId, s.id) })));
}

export async function createPriceSheet(studioId: string, name: string, priceRows: ProductPriceInput[]) {
  const sheet = one<PriceSheet>(await db()`insert into price_sheets (studio_id, name) values (${studioId}, ${name.trim()}) returning *`);
  if (!sheet) throw new Error("Could not create price sheet");
  await replacePriceSheetRows(studioId, sheet.id, priceRows);
  return sheet;
}

export async function replacePriceSheetRows(studioId: string, sheetId: string, priceRows: ProductPriceInput[]) {
  const owned = one<PriceSheet>(await db()`select * from price_sheets where id = ${sheetId} and studio_id = ${studioId}`);
  if (!owned) throw new Error("Not found");
  await db()`delete from price_sheet_rows where studio_id = ${studioId} and sheet_id = ${sheetId}`;
  let i = 0;
  for (const r of priceRows) {
    await db()`
      insert into price_sheet_rows (studio_id, sheet_id, resolution, license, amount_cents, min_pick, max_pick, sort_order)
      values (${studioId}, ${sheetId}, ${r.resolution}, ${r.license}, ${r.amountCents}, ${r.minPick ?? null}, ${r.maxPick ?? null}, ${i++})`;
  }
  await db()`update price_sheets set updated_at = now() where id = ${sheetId} and studio_id = ${studioId}`;
}

export async function deletePriceSheet(studioId: string, sheetId: string) {
  await db()`delete from price_sheets where id = ${sheetId} and studio_id = ${studioId}`;
}

/** Copy a sheet's rows onto a product, replacing its current price rows. */
export async function applyPriceSheetToProduct(studioId: string, sheetId: string, productId: string) {
  const sheetRows = await listPriceSheetRows(studioId, sheetId);
  if (sheetRows.length === 0) return null;
  const priceRows: ProductPriceInput[] = sheetRows.map((r) => ({ resolution: r.resolution, license: r.license, amountCents: r.amount_cents, minPick: r.min_pick, maxPick: r.max_pick }));
  return replaceProductPrices(studioId, productId, priceRows);
}

// --- Collections ------------------------------------------------------------

export type CollectionInput = { title: string; description?: string | null; coverAssetId?: string | null; visibility?: StoreCollection["visibility"] };

export async function listCollections(studioId: string) {
  return rows<StoreCollection>(await db()`select * from store_collections where studio_id = ${studioId} order by sort_order, created_at`);
}

export async function createCollection(studioId: string, input: CollectionInput) {
  const root = normalizeSlug(input.title) || "collection";
  let slug = root;
  for (let i = 2; (await db()`select 1 from store_collections where studio_id = ${studioId} and slug = ${slug}`).length > 0; i++) slug = `${root}-${i}`;
  const next = one<{ n: number }>(await db()`select coalesce(max(sort_order), 0) + 1 as n from store_collections where studio_id = ${studioId}`);
  return one<StoreCollection>(
    await db()`
      insert into store_collections (studio_id, slug, title, description, cover_asset_id, visibility, sort_order)
      values (${studioId}, ${slug}, ${input.title.trim()}, ${input.description ?? null}, ${input.coverAssetId ?? null}, ${input.visibility ?? "public"}, ${next?.n ?? 1})
      returning *`
  );
}

export async function getCollection(studioId: string, id: string) {
  return one<StoreCollection>(await db()`select * from store_collections where id = ${id} and studio_id = ${studioId}`);
}

export async function getCollectionBySlug(studioId: string, slug: string) {
  return one<StoreCollection>(await db()`select * from store_collections where slug = ${slug} and studio_id = ${studioId}`);
}

/** The active collection-unlock product selling a given collection, if any (for a buy CTA). */
export async function getCollectionUnlockProduct(studioId: string, collectionId: string) {
  return one<StoreProduct>(
    await db()`select * from store_products where studio_id = ${studioId} and collection_id = ${collectionId} and kind = 'collection_unlock' and is_active order by created_at limit 1`
  );
}

/** Public collections that have at least one ready image, for the shop's collections strip. */
export async function listPublicCollections(studioId: string) {
  const cs = rows<{ id: string; slug: string; title: string; description: string | null; count: number; cover_thumb: string | null; cover_web: string | null; cover_url: string | null }>(
    await db()`
      select c.id, c.slug, c.title, c.description,
        (select count(*)::int from store_collection_items ci join assets a on a.id = ci.asset_id and a.studio_id = ci.studio_id where ci.collection_id = c.id and a.url not like 'pending:%') as count,
        a.thumb_url as cover_thumb, a.web_url as cover_web, a.url as cover_url
      from store_collections c left join assets a on a.id = c.cover_asset_id and a.studio_id = c.studio_id
      where c.studio_id = ${studioId} and c.visibility = 'public'
      order by c.sort_order, c.created_at`
  );
  return cs.filter((c) => c.count > 0);
}

export async function updateCollection(studioId: string, id: string, input: CollectionInput) {
  return one<StoreCollection>(
    await db()`
      update store_collections set title = ${input.title.trim()}, description = ${input.description ?? null},
        cover_asset_id = ${input.coverAssetId ?? null}, visibility = ${input.visibility ?? "public"}, updated_at = now()
      where id = ${id} and studio_id = ${studioId} returning *`
  );
}

/** Delete a collection. Any collection_unlock product pointing at it is archived by the caller. */
export async function deleteCollection(studioId: string, id: string) {
  await db()`delete from store_collections where id = ${id} and studio_id = ${studioId}`;
}

export async function listCollectionItems(studioId: string, collectionId: string) {
  return rows<StoreCollectionItem>(await db()`select * from store_collection_items where studio_id = ${studioId} and collection_id = ${collectionId} order by sort_order, created_at`);
}

/** Add an asset to a collection (idempotent per asset). Photos join via galleries/gallery_unlock. */
export async function addCollectionAsset(studioId: string, collectionId: string, assetId: string) {
  const owned = await getCollection(studioId, collectionId);
  if (!owned) throw new Error("Not found");
  await assertOwned("assets", assetId, studioId); // never let another studio's asset into a collection
  const exists = await db()`select 1 from store_collection_items where studio_id = ${studioId} and collection_id = ${collectionId} and asset_id = ${assetId} limit 1`;
  if (exists.length > 0) return;
  const next = one<{ n: number }>(await db()`select coalesce(max(sort_order), 0) + 1 as n from store_collection_items where collection_id = ${collectionId}`);
  await db()`insert into store_collection_items (studio_id, collection_id, asset_id, sort_order) values (${studioId}, ${collectionId}, ${assetId}, ${next?.n ?? 1})`;
}

export async function removeCollectionItem(studioId: string, itemId: string) {
  await db()`delete from store_collection_items where id = ${itemId} and studio_id = ${studioId}`;
}

/** Assets in a collection, with their display URLs, for the admin manager and storefront. */
export async function listCollectionAssets(studioId: string, collectionId: string) {
  return rows<{ item_id: string; asset_id: string; filename: string; thumb_url: string | null; web_url: string | null; url: string }>(
    await db()`
      select ci.id as item_id, a.id as asset_id, a.filename, a.thumb_url, a.web_url, a.url
      from store_collection_items ci join assets a on a.id = ci.asset_id and a.studio_id = ci.studio_id
      where ci.studio_id = ${studioId} and ci.collection_id = ${collectionId} and ci.asset_id is not null
        and a.url not like 'pending:%'
      order by ci.sort_order, ci.created_at`
  );
}

// --- Discount codes ---------------------------------------------------------

export type DiscountInput = {
  code: string;
  kind: "percent" | "fixed" | "free_ship";
  value: number;
  minSubtotalCents?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  maxUses?: number | null;
};

export async function listDiscounts(studioId: string) {
  return rows<DiscountCode>(await db()`select * from discount_codes where studio_id = ${studioId} order by created_at desc`);
}

export async function createDiscount(studioId: string, input: DiscountInput) {
  return one<DiscountCode>(
    await db()`
      insert into discount_codes (studio_id, code, kind, value, min_subtotal_cents, starts_at, ends_at, max_uses)
      values (${studioId}, ${input.code.trim().toUpperCase()}, ${input.kind}, ${input.value}, ${input.minSubtotalCents ?? null}, ${input.startsAt ?? null}, ${input.endsAt ?? null}, ${input.maxUses ?? null})
      on conflict (studio_id, code) do update set kind = excluded.kind, value = excluded.value, min_subtotal_cents = excluded.min_subtotal_cents, starts_at = excluded.starts_at, ends_at = excluded.ends_at, max_uses = excluded.max_uses, is_active = true, updated_at = now()
      returning *`
  );
}

export async function setDiscountActive(studioId: string, id: string, active: boolean) {
  return one<DiscountCode>(await db()`update discount_codes set is_active = ${active} where id = ${id} and studio_id = ${studioId} returning *`);
}

/** A code that is active, within its window, under its cap and meets the minimum, else null. */
export async function findValidDiscount(studioId: string, code: string, subtotalCents: number, now = new Date()) {
  const dc = one<DiscountCode>(await db()`select * from discount_codes where studio_id = ${studioId} and upper(code) = upper(${code.trim()}) and is_active limit 1`);
  if (!dc) return null;
  if (dc.starts_at && new Date(dc.starts_at) > now) return null;
  if (dc.ends_at && new Date(dc.ends_at) < now) return null;
  if (dc.max_uses != null && dc.uses >= dc.max_uses) return null;
  if (dc.min_subtotal_cents != null && subtotalCents < dc.min_subtotal_cents) return null;
  return dc;
}

export async function recordRedemption(studioId: string, codeId: string, saleId: string, amountCents: number) {
  await db()`insert into discount_redemptions (studio_id, code_id, sale_id, amount_cents) values (${studioId}, ${codeId}, ${saleId}, ${amountCents})`;
  await db()`update discount_codes set uses = uses + 1 where id = ${codeId}`;
}

/** Records a paid sale's discount against its code (idempotent per sale via a unique redemption). */
export async function recordSaleRedemption(sale: Pick<Sale, "id" | "studio_id" | "discount_code" | "discount_cents">) {
  if (!sale.discount_code || sale.discount_cents <= 0) return;
  const already = await db()`select 1 from discount_redemptions where sale_id = ${sale.id} limit 1`;
  if (already.length > 0) return;
  const dc = one<{ id: string }>(await db()`select id from discount_codes where studio_id = ${sale.studio_id} and upper(code) = upper(${sale.discount_code}) limit 1`);
  if (dc) await recordRedemption(sale.studio_id, dc.id, sale.id, sale.discount_cents);
}

// --- Gift cards -------------------------------------------------------------

// No 0/O/1/I so a code survives being read aloud or typed from a photo.
const GIFT_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** A friendly 16-char code shown in four groups, e.g. ABCD-EFGH-JKLM-NPQR. */
function generateGiftCode() {
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) out += GIFT_ALPHABET[bytes[i] % GIFT_ALPHABET.length];
  return out.match(/.{1,4}/g)!.join("-");
}

/** Keyed hash of a normalised code — we store this, never the code itself. */
function giftCodeHash(normalized: string) {
  return hmac(requireEnv("APP_SECRET"), `gift.${normalized}`);
}

export async function listGiftCards(studioId: string) {
  return rows<GiftCard>(await db()`select * from gift_cards where studio_id = ${studioId} order by created_at desc`);
}

/**
 * Issue a gift card. Returns the row plus its plaintext code, which is shown
 * only once (the studio hands it to the buyer); we keep only a keyed hash.
 */
export async function issueGiftCard(studioId: string, input: { initialCents: number; currency: string; expiresAt?: string | null }) {
  const code = generateGiftCode();
  const normalized = normalizeGiftCode(code);
  const card = one<GiftCard>(
    await db()`
      insert into gift_cards (studio_id, code_hash, code_last4, initial_cents, balance_cents, currency, expires_at)
      values (${studioId}, ${giftCodeHash(normalized)}, ${normalized.slice(-4)}, ${input.initialCents}, ${input.initialCents}, ${input.currency}, ${input.expiresAt ?? null})
      returning *`
  );
  if (!card) throw new Error("Could not issue gift card");
  await db()`insert into gift_card_txns (studio_id, gift_card_id, delta_cents, reason) values (${studioId}, ${card.id}, ${input.initialCents}, 'issued')`;
  return { card, code };
}

export async function setGiftCardActive(studioId: string, id: string, active: boolean) {
  return one<GiftCard>(await db()`update gift_cards set is_active = ${active} where id = ${id} and studio_id = ${studioId} returning *`);
}

/** Studio manually credits or debits a balance (comp, correction); logs the delta. Never below zero. */
export async function adjustGiftCard(studioId: string, id: string, deltaCents: number, reason: string) {
  const card = one<GiftCard>(
    await db()`update gift_cards set balance_cents = greatest(0, balance_cents + ${deltaCents}) where id = ${id} and studio_id = ${studioId} returning *`
  );
  if (!card) return null;
  await db()`insert into gift_card_txns (studio_id, gift_card_id, delta_cents, reason) values (${studioId}, ${id}, ${deltaCents}, ${reason})`;
  return card;
}

export async function listGiftCardTxns(studioId: string, cardId: string) {
  return rows<GiftCardTxn>(await db()`select * from gift_card_txns where studio_id = ${studioId} and gift_card_id = ${cardId} order by created_at desc`);
}

/** An active, unexpired card with a positive balance, matched by its code; else null. */
export async function findUsableGiftCard(studioId: string, code: string, now = new Date()) {
  const normalized = normalizeGiftCode(code);
  if (normalized.length < 8) return null;
  const card = one<GiftCard>(
    await db()`select * from gift_cards where studio_id = ${studioId} and code_hash = ${giftCodeHash(normalized)} and is_active and balance_cents > 0 limit 1`
  );
  if (!card) return null;
  if (card.expires_at && new Date(card.expires_at) < now) return null;
  return card;
}

/**
 * Draw down a card's balance for a sale in a single guarded statement, so
 * concurrent spends can never push it below zero. Returns the cents actually
 * spent (min of the asked amount and the balance) and logs a ledger entry.
 */
export async function spendGiftCard(studioId: string, cardId: string, saleId: string, amountCents: number) {
  if (amountCents <= 0) return 0;
  const r = one<{ spent: number }>(
    await db()`
      with c as (select balance_cents from gift_cards where id = ${cardId} and studio_id = ${studioId} for update)
      update gift_cards g set balance_cents = g.balance_cents - least(g.balance_cents, ${amountCents})
      from c where g.id = ${cardId} and g.studio_id = ${studioId}
      returning least(c.balance_cents, ${amountCents})::int as spent`
  );
  const spent = r?.spent ?? 0;
  if (spent > 0) {
    await db()`insert into gift_card_txns (studio_id, gift_card_id, sale_id, delta_cents, reason) values (${studioId}, ${cardId}, ${saleId}, ${-spent}, 'redeemed')`;
  }
  return spent;
}

/** Draws down a paid sale's gift card once (idempotent per sale via the ledger). */
export async function recordSaleGiftCard(sale: Pick<Sale, "id" | "studio_id" | "gift_card_id" | "gift_card_cents">) {
  if (!sale.gift_card_id || sale.gift_card_cents <= 0) return;
  const already = await db()`select 1 from gift_card_txns where sale_id = ${sale.id} and reason = 'redeemed' limit 1`;
  if (already.length > 0) return;
  await spendGiftCard(sale.studio_id, sale.gift_card_id, sale.id, sale.gift_card_cents);
}

/**
 * Issues a fresh gift card for every gift_card line on a paid sale — its balance
 * is the line's amount. Idempotent via gift_cards.sale_item_id. Returns the
 * plaintext codes (cents) so the caller can email them to the buyer.
 */
export async function issueSoldGiftCards(sale: Pick<Sale, "id" | "studio_id" | "currency">) {
  const items = rows<SaleItem>(await db()`select * from sale_items where sale_id = ${sale.id} and kind = 'gift_card' and amount_cents > 0`);
  const issued: { code: string; amountCents: number }[] = [];
  for (const it of items) {
    const existing = await db()`select 1 from gift_cards where sale_item_id = ${it.id} limit 1`;
    if (existing.length > 0) continue;
    const code = generateGiftCode();
    const normalized = normalizeGiftCode(code);
    const card = one<GiftCard>(
      await db()`
        insert into gift_cards (studio_id, code_hash, code_last4, initial_cents, balance_cents, currency, sale_item_id)
        values (${sale.studio_id}, ${giftCodeHash(normalized)}, ${normalized.slice(-4)}, ${it.amount_cents}, ${it.amount_cents}, ${sale.currency}, ${it.id})
        on conflict (sale_item_id) where sale_item_id is not null do nothing
        returning *`
    );
    if (card) {
      await db()`insert into gift_card_txns (studio_id, gift_card_id, sale_id, delta_cents, reason) values (${sale.studio_id}, ${card.id}, ${sale.id}, ${it.amount_cents}, 'sold')`;
      issued.push({ code, amountCents: it.amount_cents });
    }
  }
  return issued;
}

// --- Favorites / wishlist ---------------------------------------------------

/** The product ids a buyer has favourited at one studio, for marking the grid. */
export async function listFavoriteProductIds(studioId: string, buyerKey: string) {
  const r = rows<{ product_id: string }>(await db()`select product_id from store_favorites where studio_id = ${studioId} and buyer_key = ${buyerKey} and product_id is not null`);
  return new Set(r.map((x) => x.product_id));
}

/** Toggle a product favourite; returns the new state (true = now favourited). */
export async function toggleFavorite(studioId: string, buyerKey: string, productId: string) {
  const existing = await db()`select 1 from store_favorites where studio_id = ${studioId} and buyer_key = ${buyerKey} and product_id = ${productId} limit 1`;
  if (existing.length > 0) {
    await db()`delete from store_favorites where studio_id = ${studioId} and buyer_key = ${buyerKey} and product_id = ${productId}`;
    return false;
  }
  await db()`insert into store_favorites (studio_id, buyer_key, product_id) values (${studioId}, ${buyerKey}, ${productId}) on conflict (studio_id, buyer_key, product_id) do nothing`;
  return true;
}

/** A buyer's favourited, still-active products (most recent first). */
export async function listFavoriteProducts(studioId: string, buyerKey: string) {
  return rows<StoreProduct>(
    await db()`
      select p.* from store_favorites f join store_products p on p.id = f.product_id
      where f.studio_id = ${studioId} and f.buyer_key = ${buyerKey} and p.is_active
      order by f.created_at desc`
  );
}

// --- Fast path: sell an existing gallery photo or portfolio asset -----------

export async function markSellable(
  studioId: string,
  input: { photoId?: string | null; assetId?: string | null; galleryId?: string | null; title: string; prices?: ProductPriceInput[] }
) {
  const product = await createProduct(studioId, {
    kind: "image",
    title: input.title,
    photoId: input.photoId ?? null,
    assetId: input.assetId ?? null,
    galleryId: input.galleryId ?? null,
  });
  if (!product) throw new Error("Could not create product");
  if (input.prices?.length) await replaceProductPrices(studioId, product.id, input.prices);
  return product;
}

// --- Sales -----------------------------------------------------------------

export type NewSaleItem = {
  productId: string | null;
  photoId?: string | null;
  assetId?: string | null;
  kind: string;
  resolution: StoreResolution;
  license: StoreLicense;
  qty: number;
  unitAmountCents: number;
  amountCents: number;
  usageScope?: Record<string, unknown>;
};

async function nextSaleNumber(studioId: string) {
  const r = one<{ n: number }>(await db()`select coalesce(max(order_number), 1000) + 1 as n from sales where studio_id = ${studioId}`);
  return r?.n ?? 1001;
}

export async function createSale(
  studioId: string,
  input: {
    buyerEmail: string;
    buyerName?: string | null;
    buyerClientId?: string | null;
    currency: string;
    paymentMode: StorePaymentMode;
    items: NewSaleItem[];
    discountCents?: number;
    discountCode?: string | null;
    giftCardId?: string | null;
    giftCardCents?: number;
  }
) {
  const subtotal = input.items.reduce((s, i) => s + i.amountCents, 0);
  const discount = Math.min(subtotal, Math.max(0, input.discountCents ?? 0));
  const afterDiscount = subtotal - discount;
  const gift = Math.min(afterDiscount, Math.max(0, input.giftCardCents ?? 0));
  const total = Math.max(0, afterDiscount - gift);
  const number = await nextSaleNumber(studioId);
  const sale = one<Sale>(
    await db()`
      insert into sales (studio_id, order_number, buyer_email, buyer_name, buyer_client_id, subtotal_cents, discount_cents, total_cents, currency, status, payment_mode, discount_code, gift_card_id, gift_card_cents)
      values (${studioId}, ${number}, ${input.buyerEmail}, ${input.buyerName ?? null}, ${input.buyerClientId ?? null}, ${subtotal}, ${discount}, ${total}, ${input.currency}, 'pending', ${input.paymentMode}, ${input.discountCode ?? null}, ${input.giftCardId ?? null}, ${gift})
      returning *`
  );
  if (!sale) throw new Error("Could not create sale");
  for (const it of input.items) {
    await db()`
      insert into sale_items (studio_id, sale_id, product_id, photo_id, asset_id, kind, resolution, license, usage_scope, qty, unit_amount_cents, amount_cents)
      values (${studioId}, ${sale.id}, ${it.productId}, ${it.photoId ?? null}, ${it.assetId ?? null}, ${it.kind}, ${it.resolution}, ${it.license}, ${JSON.stringify(it.usageScope ?? {})}::jsonb, ${it.qty}, ${it.unitAmountCents}, ${it.amountCents})`;
  }
  return sale;
}

export async function getSale(studioId: string, id: string) {
  return one<Sale>(await db()`select * from sales where id = ${id} and studio_id = ${studioId}`);
}

export async function getSaleById(id: string) {
  return one<Sale>(await db()`select * from sales where id = ${id}`);
}

export async function listSales(studioId: string, limit = 200) {
  return rows<Sale>(await db()`select * from sales where studio_id = ${studioId} and status <> 'pending' order by created_at desc limit ${limit}`);
}

export async function listPendingManualSales(studioId: string) {
  return rows<Sale>(await db()`select * from sales where studio_id = ${studioId} and status = 'pending' and payment_mode = 'manual' order by created_at desc limit 100`);
}

/** A buyer's completed orders at one studio, for the no-login order history in the library. */
export async function listPaidSalesForBuyer(studioId: string, email: string) {
  return rows<Sale>(
    await db()`select * from sales where studio_id = ${studioId} and lower(buyer_email) = lower(${email}) and status in ('paid', 'partially_refunded', 'refunded', 'disputed') order by created_at desc limit 50`
  );
}

export async function storeRevenueCents(studioId: string) {
  const r = one<{ n: number }>(await db()`select coalesce(sum(total_cents - refunded_cents), 0)::int as n from sales where studio_id = ${studioId} and status in ('paid', 'partially_refunded')`);
  return r?.n ?? 0;
}

/** Sales reporting from the orders themselves (revenue, AOV, top products/buyers). */
export async function storeAnalytics(studioId: string) {
  const totals = one<{ gross: number; net: number; orders: number }>(
    await db()`select coalesce(sum(total_cents), 0)::int as gross, coalesce(sum(total_cents - refunded_cents), 0)::int as net, count(*)::int as orders
      from sales where studio_id = ${studioId} and status in ('paid', 'partially_refunded')`
  );
  const units = one<{ n: number }>(
    await db()`select coalesce(count(*), 0)::int as n from sale_items si join sales s on s.id = si.sale_id
      where si.studio_id = ${studioId} and s.status in ('paid', 'partially_refunded') and si.kind not in ('gift_card', 'voucher')`
  );
  const giftOutstanding = one<{ n: number }>(await db()`select coalesce(sum(balance_cents), 0)::int as n from gift_cards where studio_id = ${studioId} and is_active`);
  const topProducts = rows<{ title: string; units: number; revenue: number }>(
    await db()`select coalesce(p.title, 'Image') as title, count(*)::int as units, coalesce(sum(si.amount_cents), 0)::int as revenue
      from sale_items si join sales s on s.id = si.sale_id left join store_products p on p.id = si.product_id
      where si.studio_id = ${studioId} and s.status in ('paid', 'partially_refunded') and si.kind not in ('gift_card', 'voucher')
      group by p.title order by revenue desc, units desc limit 5`
  );
  const topBuyers = rows<{ email: string; orders: number; spend: number }>(
    await db()`select buyer_email as email, count(*)::int as orders, coalesce(sum(total_cents - refunded_cents), 0)::int as spend
      from sales where studio_id = ${studioId} and status in ('paid', 'partially_refunded')
      group by buyer_email order by spend desc limit 5`
  );
  // Last-30-day funnel counts from the daily analytics rollup (S25).
  const funnel = one<{ store_views: number; product_views: number; cart_adds: number; checkout_starts: number; purchases: number }>(
    await db()`
      select
        coalesce(sum(count) filter (where event = 'store_view'), 0)::int as store_views,
        coalesce(sum(count) filter (where event = 'product_view'), 0)::int as product_views,
        coalesce(sum(count) filter (where event = 'cart_add'), 0)::int as cart_adds,
        coalesce(sum(count) filter (where event = 'checkout_start'), 0)::int as checkout_starts,
        coalesce(sum(count) filter (where event = 'purchase'), 0)::int as purchases
      from analytics_daily
      where studio_id = ${studioId} and day >= current_date - 30
        and event in ('store_view', 'product_view', 'cart_add', 'checkout_start', 'purchase')`
  );
  const orders = totals?.orders ?? 0;
  const net = totals?.net ?? 0;
  const productViews = funnel?.product_views ?? 0;
  const purchases = funnel?.purchases ?? 0;
  return {
    grossCents: totals?.gross ?? 0,
    netCents: net,
    orders,
    aovCents: orders > 0 ? Math.round(net / orders) : 0,
    unitsSold: units?.n ?? 0,
    giftCardOutstandingCents: giftOutstanding?.n ?? 0,
    topProducts,
    topBuyers,
    funnel: {
      storeViews: funnel?.store_views ?? 0,
      productViews,
      cartAdds: funnel?.cart_adds ?? 0,
      checkoutStarts: funnel?.checkout_starts ?? 0,
      purchases,
    },
    // Purchases per product view, last 30 days; the headline storefront conversion.
    conversionPct: productViews > 0 ? Math.round((purchases / productViews) * 1000) / 10 : 0,
  };
}

export async function attachSaleSession(saleId: string, sessionId: string, accountId: string | null) {
  await db()`update sales set stripe_checkout_session_id = ${sessionId}, stripe_account_id = ${accountId} where id = ${saleId}`;
}

export async function listSaleItems(saleId: string) {
  return rows<SaleItem>(await db()`select * from sale_items where sale_id = ${saleId} order by created_at`);
}

/** Grouped licence lines for a sale, for the buyer's printable licence document. */
export async function saleLicenseLines(studioId: string, saleId: string) {
  return rows<{ license: StoreLicense; resolution: StoreResolution; title: string; license_text: string | null; usage_scope: Record<string, unknown>; count: number }>(
    await db()`
      select si.license, si.resolution, coalesce(p.title, 'Image') as title, p.license_text, si.usage_scope, count(*)::int as count
      from sale_items si left join store_products p on p.id = si.product_id
      where si.sale_id = ${saleId} and si.studio_id = ${studioId}
      group by si.license, si.resolution, p.title, p.license_text, si.usage_scope
      order by title`
  );
}

/**
 * Marks a sale paid from its Checkout Session. Returns { sale, firstTime };
 * firstTime is true only on the pending -> paid transition, so grants and the
 * delivery email fire exactly once.
 */
export async function markSalePaid(saleId: string, ref: { paymentIntentId?: string | null; chargeId?: string | null; receiptUrl?: string | null }) {
  const updated = one<Sale>(
    await db()`
      update sales set status = 'paid', paid_at = coalesce(paid_at, now()),
        stripe_payment_intent_id = coalesce(${ref.paymentIntentId ?? null}, stripe_payment_intent_id),
        stripe_charge_id = coalesce(${ref.chargeId ?? null}, stripe_charge_id),
        receipt_url = coalesce(${ref.receiptUrl ?? null}, receipt_url)
      where id = ${saleId} and status = 'pending'
      returning *`
  );
  if (updated) return { sale: updated, firstTime: true };
  const existing = await getSaleById(saleId);
  return existing ? { sale: existing, firstTime: false } : null;
}

// --- Digital product files (S21) --------------------------------------------

export type DigitalUploadMeta = { filename: string; size: number; contentType: string };

/**
 * Reserve a digital_files row and a direct-upload token into the PRIVATE
 * galleries store (a sold file must never be publicly reachable — it is
 * delivered only through a download grant). Mirrors beginAssetUpload.
 */
export async function beginDigitalUpload(studioId: string, productId: string, meta: DigitalUploadMeta) {
  if (meta.size <= 0 || meta.size > MAX_DIGITAL_BYTES) throw new Error(`Files must be under ${Math.round(MAX_DIGITAL_BYTES / 1024 / 1024)} MB.`);
  if (!digitalExtOk(meta.filename)) throw new Error("That file type can't be sold as a digital download.");
  const product = await getProduct(studioId, productId);
  if (!product || product.kind !== "digital") throw new Error("Not a digital product.");
  await assertUnderStorageCap(studioId);
  const filename = safeFilename(meta.filename, "download");
  const pathname = digitalPath(studioId, `${productId}/${Date.now()}-${filename}`);
  const contentType = meta.contentType || "application/octet-stream";
  const file = one<DigitalFile>(
    await db()`
      insert into digital_files (studio_id, product_id, url, filename, content_type, size_bytes)
      values (${studioId}, ${productId}, ${`pending:${pathname}`}, ${filename}, ${contentType}, ${meta.size})
      returning *`
  );
  if (!file) throw new Error("Could not start the upload.");
  const token = await clientUploadToken({ store: "galleries", pathname, maximumSizeInBytes: meta.size + 1024, allowedContentTypes: [contentType] });
  return { fileId: file.id, pathname, token };
}

/** After the bytes land: flip the row from pending to its real URL and meter the storage. */
export async function completeDigitalUpload(studioId: string, fileId: string, url: string) {
  const file = one<DigitalFile>(await db()`select * from digital_files where id = ${fileId} and studio_id = ${studioId}`);
  if (!file) throw new Error("Not found");
  const updated = one<DigitalFile>(await db()`update digital_files set url = ${url} where id = ${fileId} and studio_id = ${studioId} returning *`);
  if (file.url.startsWith("pending:")) await addBytes(studioId, file.size_bytes);
  return updated;
}

/** Ready (uploaded) files of a digital product, in upload order. */
export async function listDigitalFiles(studioId: string, productId: string) {
  return rows<DigitalFile>(await db()`select * from digital_files where product_id = ${productId} and studio_id = ${studioId} and url not like 'pending:%' order by created_at`);
}

/** Filenames for a set of digital files, keyed by id — for labelling library download rows. */
export async function digitalFileNames(studioId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, string>();
  const r = rows<{ id: string; filename: string }>(await db()`select id, filename from digital_files where studio_id = ${studioId} and id = any(${unique}::uuid[])`);
  return new Map(r.map((x) => [x.id, x.filename]));
}

/** Remove a digital file and its blob; free the storage it counted for. */
export async function deleteDigitalFile(studioId: string, fileId: string) {
  const file = one<DigitalFile>(await db()`select * from digital_files where id = ${fileId} and studio_id = ${studioId}`);
  if (!file) return { deleted: false };
  const pending = file.url.startsWith("pending:");
  if (!pending) await deleteBlobs("galleries", [file.url]);
  await db()`delete from digital_files where id = ${fileId} and studio_id = ${studioId}`;
  if (!pending) await addBytes(studioId, -file.size_bytes);
  return { deleted: true };
}

// --- Download grants --------------------------------------------------------

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * The capability token for a grant: derived from its id + APP_SECRET, so it is
 * stateless (recomputable when rendering the library) yet unguessable.
 */
export function grantToken(grantId: string) {
  return hmac(requireEnv("APP_SECRET"), `grant.${grantId}`);
}

/** One grant per purchased item. Idempotent: does nothing if grants already exist. */
export async function mintGrants(sale: Pick<Sale, "id" | "studio_id">, opts: { maxDownloads: number; windowHours: number }) {
  const existing = await db()`select 1 from download_grants where sale_id = ${sale.id} limit 1`;
  if (existing.length > 0) return;
  const items = await listSaleItems(sale.id);
  for (const it of items) {
    if (it.kind === "gift_card" || it.kind === "voucher") continue; // nothing to download
    if (it.kind === "digital") {
      // A digital product delivers its uploaded files, one grant each (no
      // resolution tiers): the file is served as-is from the private store.
      const files = it.product_id ? await listDigitalFiles(sale.studio_id, it.product_id) : [];
      for (const f of files) {
        const grant = one<DownloadGrant>(
          await db()`
            insert into download_grants (studio_id, sale_id, sale_item_id, file_id, resolution, token_hash, expires_at, max_downloads)
            values (${sale.studio_id}, ${sale.id}, ${it.id}, ${f.id}, 'original', ${"pending"}, now() + (${opts.windowHours} || ' hours')::interval, ${opts.maxDownloads})
            returning *`
        );
        if (grant) await db()`update download_grants set token_hash = ${sha256Hex(grantToken(grant.id))} where id = ${grant.id}`;
      }
      continue;
    }
    const grant = one<DownloadGrant>(
      await db()`
        insert into download_grants (studio_id, sale_id, sale_item_id, photo_id, resolution, token_hash, expires_at, max_downloads)
        values (${sale.studio_id}, ${sale.id}, ${it.id}, ${it.photo_id}, ${it.resolution}, ${"pending"}, now() + (${opts.windowHours} || ' hours')::interval, ${opts.maxDownloads})
        returning *`
    );
    if (grant) await db()`update download_grants set token_hash = ${sha256Hex(grantToken(grant.id))} where id = ${grant.id}`;
  }
}

export async function listGrantsForSale(saleId: string) {
  return rows<DownloadGrant>(await db()`select * from download_grants where sale_id = ${saleId} order by created_at`);
}

/** Resolve a grant by its capability token, enforcing expiry, cap and revocation. */
export async function getUsableGrantByToken(token: string) {
  return one<DownloadGrant>(
    await db()`select * from download_grants where token_hash = ${sha256Hex(token)}
      and not revoked and downloads_used < max_downloads and (expires_at is null or expires_at > now()) limit 1`
  );
}

export async function recordGrantDownload(grant: Pick<DownloadGrant, "id" | "studio_id">, meta: { ip: string | null; ua: string | null; bytes: number }) {
  await db()`update download_grants set downloads_used = downloads_used + 1 where id = ${grant.id}`;
  await db()`insert into download_events (studio_id, grant_id, ip, ua, bytes) values (${grant.studio_id}, ${grant.id}, ${meta.ip}, ${meta.ua}, ${meta.bytes})`;
}

export async function revokeGrantsForSale(saleId: string) {
  await db()`update download_grants set revoked = true where sale_id = ${saleId}`;
}

/**
 * Daily store housekeeping (S29): drop long-dead revoked grants and their audit
 * rows, prune old download events, and clear abandoned, never-recovered carts.
 * Expired-but-live grants are left in place so the buyer's long-lived library
 * still shows an "expired" state rather than a blank. Idempotent by construction.
 */
export async function cleanupStore() {
  const events = await db()`delete from download_events where created_at < now() - interval '365 days' returning id`;
  const grants = await db()`delete from download_grants where revoked and created_at < now() - interval '90 days' returning id`;
  const carts = await db()`delete from carts where recovered_at is null and updated_at < now() - interval '30 days' returning id`;
  return { events: events.length, grants: grants.length, carts: carts.length };
}

/**
 * Abandoned-checkout recovery (S22): a connected store sale still `pending` a day
 * after it was started never completed at Stripe, so nudge the buyer back to the
 * shop once (idempotent via automation_sends). Manual-mode pending sales are the
 * studio's to collect, so they're excluded.
 */
export async function recoverAbandonedCheckouts(olderThanHours = 24, withinDays = 7) {
  const due = rows<{ id: string; studio_id: string; buyer_email: string; buyer_name: string | null; total_cents: number; currency: string; slug: string; name: string; email: string; custom_domain: string | null; custom_domain_verified_at: string | null; settings: Record<string, unknown> }>(
    await db()`
      select s.id, s.studio_id, s.buyer_email, s.buyer_name, s.total_cents, s.currency,
        st.slug, st.name, st.email, st.custom_domain, st.custom_domain_verified_at, st.settings
      from sales s join studios st on st.id = s.studio_id
      where s.status = 'pending' and s.payment_mode = 'connected' and st.deleted_at is null
        and s.created_at < now() - (${olderThanHours} || ' hours')::interval
        and s.created_at > now() - (${withinDays} || ' days')::interval`
  );
  let sent = 0;
  for (const s of due) {
    if (!storeSettings(s.settings ?? {}).enabled) continue;
    const marked = await db()`insert into automation_sends (studio_id, rule, target) values (${s.studio_id}, 'store_abandoned', ${s.id}) on conflict do nothing returning rule`;
    if (marked.length === 0) continue;
    const url = shopUrl({ slug: s.slug, custom_domain: s.custom_domain, custom_domain_verified_at: s.custom_domain_verified_at });
    await sendStoreAbandonedEmail({ id: s.studio_id, name: s.name, email: s.email }, { to: s.buyer_email, buyerName: s.buyer_name, amount: formatMoney(s.total_cents, s.currency), url }).catch(() => undefined);
    sent++;
  }
  return sent;
}

/**
 * Fulfils a paid sale once: mints download grants, records any discount
 * redemption, and emails the buyer their library link. Shared by the Stripe
 * webhook and the manual "mark paid" action. Returns the studio + amount for
 * the caller's own studio notification, or null if the sale isn't payable.
 */
export async function fulfillPaidStoreSale(saleId: string) {
  const sale = await getSaleById(saleId);
  if (!sale || sale.status !== "paid") return null;
  const studio = one<{ id: string; slug: string; name: string; email: string; custom_domain: string | null; custom_domain_verified_at: string | null; settings: Record<string, unknown> }>(
    await db()`select id, slug, name, email, custom_domain, custom_domain_verified_at, settings from studios where id = ${sale.studio_id}`
  );
  if (!studio) return null;
  const settings = storeSettings(studio.settings ?? {});
  await mintGrants(sale, { maxDownloads: settings.downloadMaxCount, windowHours: settings.downloadWindowHours });
  await track(sale.studio_id, "purchase", "order").catch(() => undefined); // once per sale (callers guard on firstTime)
  await recordSaleRedemption(sale).catch(() => undefined);
  await recordSaleGiftCard(sale).catch(() => undefined);
  const amount = formatMoney(sale.total_cents, sale.currency);
  const mail = { id: studio.id, name: studio.name, email: studio.email };
  const items = await listSaleItems(sale.id);

  // Deliverable (downloadable) items get the library link; skip it for a
  // gift-card-only order, whose email is the codes below.
  if (items.some((i) => i.kind !== "gift_card" && i.kind !== "voucher")) {
    const url = storeLibraryUrl(studio, signLink("download", sale.id));
    await sendStoreDeliveryEmail(mail, { to: sale.buyer_email, buyerName: sale.buyer_name, amount, orderNumber: sale.order_number, url }).catch(() => undefined);
  }

  // A purchased gift card issues a fresh card and emails its code to the buyer.
  const issued = await issueSoldGiftCards(sale).catch(() => [] as { code: string; amountCents: number }[]);
  if (issued.length > 0) {
    const codes = issued.map((c) => ({ code: c.code, amount: formatMoney(c.amountCents, sale.currency) }));
    await sendGiftCardEmail(mail, { to: sale.buyer_email, buyerName: sale.buyer_name, codes }).catch(() => undefined);
  }
  return { sale, studio, amount };
}

/** Studio re-sends a paid sale's download-library link to the buyer (support). */
export async function resendSaleLibraryLink(studioId: string, saleId: string) {
  const sale = await getSale(studioId, saleId);
  if (!sale || (sale.status !== "paid" && sale.status !== "partially_refunded")) return false;
  const studio = one<{ id: string; name: string; email: string; slug: string; custom_domain: string | null; custom_domain_verified_at: string | null }>(
    await db()`select id, name, email, slug, custom_domain, custom_domain_verified_at from studios where id = ${studioId}`
  );
  if (!studio) return false;
  const url = storeLibraryUrl(studio, signLink("download", sale.id));
  await sendStoreDeliveryEmail(
    { id: studio.id, name: studio.name, email: studio.email },
    { to: sale.buyer_email, buyerName: sale.buyer_name, amount: formatMoney(sale.total_cents, sale.currency), orderNumber: sale.order_number, url }
  ).catch(() => undefined);
  return true;
}

/** Studio records an off-platform (manual) payment: mark paid and fulfil. */
export async function markManualSalePaid(studioId: string, saleId: string) {
  const owned = await getSale(studioId, saleId);
  if (!owned || owned.payment_mode !== "manual") return null;
  const result = await markSalePaid(saleId, {});
  if (!result || !result.firstTime) return result?.sale ?? null;
  await fulfillPaidStoreSale(saleId);
  return result.sale;
}

/** charge.refunded on a store sale: record the refund and revoke downloads once fully refunded. */
export async function recordStoreRefundByCharge(input: { id: string; paymentIntentId: string | null; totalRefunded: number; receiptUrl: string | null }) {
  const sale = one<Sale>(
    await db()`select * from sales where stripe_charge_id = ${input.id} or (stripe_payment_intent_id = ${input.paymentIntentId} and ${input.paymentIntentId} is not null) limit 1`
  );
  if (!sale) return null;
  const status: SaleStatus = input.totalRefunded >= sale.total_cents ? "refunded" : input.totalRefunded > 0 ? "partially_refunded" : "paid";
  const updated = one<Sale>(
    await db()`
      update sales set refunded_cents = ${input.totalRefunded}, status = ${status},
        stripe_charge_id = coalesce(stripe_charge_id, ${input.id}), receipt_url = coalesce(receipt_url, ${input.receiptUrl})
      where id = ${sale.id} returning *`
  );
  if (updated && status === "refunded") await revokeGrantsForSale(sale.id);
  return updated;
}

/** charge.dispute.* on a store sale: mirror the dispute status. */
export async function recordStoreDisputeByCharge(chargeId: string | null, paymentIntentId: string | null, disputeStatus: string) {
  const updated = one<Sale>(
    await db()`
      update sales set dispute_status = ${disputeStatus},
        status = case when ${disputeStatus} = 'lost' then 'disputed' when status = 'disputed' and ${disputeStatus} in ('won', 'warning_closed') then 'paid' else status end
      where stripe_charge_id = ${chargeId} or (stripe_payment_intent_id = ${paymentIntentId} and ${paymentIntentId} is not null)
      returning *`
  );
  return updated;
}
