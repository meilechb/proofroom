import "server-only";

import { db, one, rows } from "@/lib/db";
import { normalizeSlug } from "@/lib/slug";
import type {
  ProductPrice,
  StoreCollection,
  StoreCollectionItem,
  StoreLicense,
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
