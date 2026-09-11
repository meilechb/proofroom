import "server-only";

import { createHash } from "node:crypto";
import { db, one, rows } from "@/lib/db";
import { normalizeSlug } from "@/lib/slug";
import { hmac } from "@/lib/tokens";
import { requireEnv } from "@/lib/env";
import type {
  DownloadGrant,
  ProductPrice,
  Sale,
  SaleItem,
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
      insert into product_prices (studio_id, product_id, resolution, license, amount_cents, compare_at_cents, min_pick, max_pick, sort_order)
      values (${studioId}, ${productId}, ${r.resolution}, ${r.license}, ${r.amountCents}, ${r.compareAtCents ?? null}, ${r.minPick ?? null}, ${r.maxPick ?? null}, ${i++})`;
  }
  return listProductPrices(studioId, productId);
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

export async function listCollectionItems(studioId: string, collectionId: string) {
  return rows<StoreCollectionItem>(await db()`select * from store_collection_items where studio_id = ${studioId} and collection_id = ${collectionId} order by sort_order, created_at`);
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
  }
) {
  const subtotal = input.items.reduce((s, i) => s + i.amountCents, 0);
  const discount = Math.min(subtotal, Math.max(0, input.discountCents ?? 0));
  const total = Math.max(0, subtotal - discount);
  const number = await nextSaleNumber(studioId);
  const sale = one<Sale>(
    await db()`
      insert into sales (studio_id, order_number, buyer_email, buyer_name, buyer_client_id, subtotal_cents, discount_cents, total_cents, currency, status, payment_mode, discount_code)
      values (${studioId}, ${number}, ${input.buyerEmail}, ${input.buyerName ?? null}, ${input.buyerClientId ?? null}, ${subtotal}, ${discount}, ${total}, ${input.currency}, 'pending', ${input.paymentMode}, ${input.discountCode ?? null})
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

export async function storeRevenueCents(studioId: string) {
  const r = one<{ n: number }>(await db()`select coalesce(sum(total_cents - refunded_cents), 0)::int as n from sales where studio_id = ${studioId} and status in ('paid', 'partially_refunded')`);
  return r?.n ?? 0;
}

export async function attachSaleSession(saleId: string, sessionId: string, accountId: string | null) {
  await db()`update sales set stripe_checkout_session_id = ${sessionId}, stripe_account_id = ${accountId} where id = ${saleId}`;
}

export async function listSaleItems(saleId: string) {
  return rows<SaleItem>(await db()`select * from sale_items where sale_id = ${saleId} order by created_at`);
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
