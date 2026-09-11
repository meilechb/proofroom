import Link from "next/link";
import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { billingState, entitlements } from "@/lib/plans";
import { effectivePrice, storeSettings } from "@/lib/store-shared";
import { listFavoriteProductIds, listProductPrices, listProducts } from "@/lib/store";
import { readBuyerKey } from "@/lib/store-buyer";
import { assetById } from "@/lib/assets";
import { formatMoney } from "@/lib/types";
import { Container } from "@/components/site/sections";
import { FavoriteButton } from "./favorite-button";
import { CartLink } from "./cart-link";
import { StoreBeacon } from "./store-beacon";

const SELLABLE = ["image", "bundle", "gallery_unlock", "collection_unlock", "digital"];

export async function generateMetadata({ params }: PageProps<"/t/[slug]/shop">) {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  return { title: studio ? `Shop — ${studio.name}` : "Shop" };
}

export default async function ShopPage({ params }: PageProps<"/t/[slug]/shop">) {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const settings = storeSettings((studio.settings ?? {}) as Record<string, unknown>);
  if (!settings.enabled || !entitlements(billingState(studio).effectivePlan).store) notFound();

  const products = (await listProducts(studio.id, { activeOnly: true })).filter((p) => SELLABLE.includes(p.kind));
  const cards = await Promise.all(
    products.map(async (p) => {
      const active = (await listProductPrices(studio.id, p.id)).filter((r) => r.is_active && r.amount_cents > 0);
      const from = active.length ? Math.min(...active.map((r) => effectivePrice(r).priceCents)) : null;
      const asset = p.asset_id ? await assetById(studio.id, p.asset_id) : null;
      return { p, from, img: asset ? asset.thumb_url ?? asset.web_url ?? asset.url : null };
    })
  );
  const cur = studio.currency;
  const buyerKey = await readBuyerKey();
  const favorites = buyerKey ? await listFavoriteProductIds(studio.id, buyerKey) : new Set<string>();

  return (
    <div className="py-12 sm:py-16">
      <StoreBeacon event="store_view" />
      <Container>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-3xl sm:text-4xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>Shop</h1>
          <div className="flex items-baseline gap-4">
            {favorites.size > 0 ? <Link href="/shop/favorites" className="text-sm underline text-[var(--site-ink-2)] hover:text-[var(--site-ink)]">Favourites ({favorites.size})</Link> : null}
            <CartLink slug={slug} />
          </div>
        </div>
        <p className="mt-2 text-[var(--site-ink-2)]">Prints and downloads from {studio.name}.</p>
        {cards.length === 0 ? (
          <p className="mt-10 text-[var(--site-ink-2)]">Nothing here yet — check back soon.</p>
        ) : (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {cards.map(({ p, from, img }) => (
              <div key={p.id} className="group relative">
                <FavoriteButton slug={slug} productId={p.id} favorited={favorites.has(p.id)} className="absolute right-2 top-2 z-10" />
                <Link href={`/shop/${p.slug}`} className="block">
                  <div className="aspect-[4/5] overflow-hidden rounded-xl bg-[var(--site-bg-2)]">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                    ) : null}
                  </div>
                  <div className="mt-2">
                    <p className="text-sm font-medium">{p.title}</p>
                    <p className="text-xs text-[var(--site-ink-2)]">{from != null ? `From ${formatMoney(from, cur)}` : "—"}</p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
