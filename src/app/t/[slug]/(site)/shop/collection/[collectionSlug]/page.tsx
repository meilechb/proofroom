import { notFound } from "next/navigation";
import Link from "next/link";
import { studioBySlug } from "@/lib/tenant-data";
import { billingState, entitlements } from "@/lib/plans";
import { effectivePrice, storeSettings } from "@/lib/store-shared";
import { getCollectionBySlug, getCollectionUnlockProduct, listCollectionAssets, listProductPrices } from "@/lib/store";
import { assetById } from "@/lib/assets";
import { formatMoney } from "@/lib/types";
import { Container } from "@/components/site/sections";
import { CartLink } from "../../cart-link";

export async function generateMetadata({ params }: PageProps<"/t/[slug]/shop/collection/[collectionSlug]">) {
  const { slug, collectionSlug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) return { title: "Collection" };
  const c = await getCollectionBySlug(studio.id, collectionSlug);
  if (!c) return { title: "Collection" };
  const cover = c.cover_asset_id ? await assetById(studio.id, c.cover_asset_id) : null;
  const image = cover ? cover.web_url ?? cover.url : null;
  const description = (c.description?.trim() || `${c.title} — a collection from ${studio.name}.`).slice(0, 200);
  return {
    title: `${c.title} — ${studio.name}`,
    description,
    robots: c.visibility !== "public" ? { index: false, follow: false } : undefined,
    openGraph: { title: c.title, description, type: "website", images: image ? [{ url: image }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title: c.title, description, images: image ? [image] : undefined },
  };
}

export default async function CollectionPage({ params }: PageProps<"/t/[slug]/shop/collection/[collectionSlug]">) {
  const { slug, collectionSlug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const settings = storeSettings((studio.settings ?? {}) as Record<string, unknown>);
  if (!settings.enabled || !entitlements(billingState(studio).effectivePlan).store) notFound();

  const collection = await getCollectionBySlug(studio.id, collectionSlug);
  if (!collection || collection.visibility === "hidden") notFound();
  const images = await listCollectionAssets(studio.id, collection.id);
  const product = await getCollectionUnlockProduct(studio.id, collection.id);
  const active = product ? (await listProductPrices(studio.id, product.id)).filter((r) => r.is_active && r.amount_cents > 0) : [];
  const from = active.length ? Math.min(...active.map((r) => effectivePrice(r).priceCents)) : null;

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="flex items-center justify-between gap-4">
          <Link href="/shop" className="text-sm text-[var(--site-ink-2)] hover:text-[var(--site-ink)]">← Shop</Link>
          <CartLink slug={slug} />
        </div>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>{collection.title}</h1>
            {collection.description ? <p className="mt-2 text-[var(--site-ink-2)]">{collection.description}</p> : null}
            <p className="mt-1 text-sm text-[var(--site-ink-2)]">{images.length} image{images.length === 1 ? "" : "s"}</p>
          </div>
          {product ? (
            <Link href={`/shop/${product.slug}`} className="inline-flex items-center justify-center rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] px-4 h-11 text-sm font-medium shrink-0">
              Buy the collection{from != null ? ` — ${formatMoney(from, studio.currency)}` : ""}
            </Link>
          ) : null}
        </div>

        {images.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((im) => (
              <div key={im.item_id} className="aspect-[4/5] overflow-hidden rounded-xl bg-[var(--site-bg-2)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.thumb_url ?? im.web_url ?? im.url} alt={im.filename} loading="lazy" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-8 text-[var(--site-ink-2)]">This collection has no images yet.</p>
        )}
      </Container>
    </div>
  );
}
