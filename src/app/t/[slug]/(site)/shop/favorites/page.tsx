import Link from "next/link";
import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { billingState, entitlements } from "@/lib/plans";
import { storeSettings } from "@/lib/store-shared";
import { listFavoriteProducts, listProductPrices } from "@/lib/store";
import { readBuyerKey } from "@/lib/store-buyer";
import { assetById } from "@/lib/assets";
import { formatMoney } from "@/lib/types";
import { Container } from "@/components/site/sections";
import { FavoriteButton } from "../favorite-button";

export const metadata = { robots: { index: false, follow: false } };

export default async function FavoritesPage({ params }: PageProps<"/t/[slug]/shop/favorites">) {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const settings = storeSettings((studio.settings ?? {}) as Record<string, unknown>);
  if (!settings.enabled || !entitlements(billingState(studio).effectivePlan).store) notFound();

  const buyerKey = await readBuyerKey();
  const products = buyerKey ? await listFavoriteProducts(studio.id, buyerKey) : [];
  const cards = await Promise.all(
    products.map(async (p) => {
      const active = (await listProductPrices(studio.id, p.id)).filter((r) => r.is_active && r.amount_cents > 0);
      const from = active.length ? Math.min(...active.map((r) => r.amount_cents)) : null;
      const asset = p.asset_id ? await assetById(studio.id, p.asset_id) : null;
      return { p, from, img: asset ? asset.thumb_url ?? asset.web_url ?? asset.url : null };
    })
  );
  const cur = studio.currency;

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <Link href="/shop" className="text-sm text-[var(--site-ink-2)] hover:text-[var(--site-ink)]">← Shop</Link>
        <h1 className="mt-3 text-3xl sm:text-4xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>Favourites</h1>
        {cards.length === 0 ? (
          <p className="mt-10 text-[var(--site-ink-2)]">No favourites yet. Tap the heart on anything in the shop to save it here.</p>
        ) : (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {cards.map(({ p, from, img }) => (
              <div key={p.id} className="group relative">
                <FavoriteButton slug={slug} productId={p.id} favorited className="absolute right-2 top-2 z-10" />
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
