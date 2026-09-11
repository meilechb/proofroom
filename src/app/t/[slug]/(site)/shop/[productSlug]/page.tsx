import { notFound } from "next/navigation";
import Link from "next/link";
import { studioBySlug } from "@/lib/tenant-data";
import { billingState, entitlements } from "@/lib/plans";
import { effectivePrice, storeSettings } from "@/lib/store-shared";
import { getProductBySlug, listFavoriteProductIds, listProductPrices, listRelatedProducts } from "@/lib/store";
import { readBuyerKey } from "@/lib/store-buyer";
import { assetById } from "@/lib/assets";
import { formatMoney } from "@/lib/types";
import { Container } from "@/components/site/sections";
import { BuyForm } from "./buy-form";
import { FavoriteButton } from "../favorite-button";
import { CartLink } from "../cart-link";

export async function generateMetadata({ params }: PageProps<"/t/[slug]/shop/[productSlug]">) {
  const { slug, productSlug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) return { title: "Shop" };
  const product = await getProductBySlug(studio.id, productSlug);
  return { title: product ? `${product.title} — ${studio.name}` : "Shop" };
}

export default async function ProductPage({ params, searchParams }: PageProps<"/t/[slug]/shop/[productSlug]">) {
  const { slug, productSlug } = await params;
  const sp = await searchParams;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const settings = storeSettings((studio.settings ?? {}) as Record<string, unknown>);
  if (!settings.enabled || !entitlements(billingState(studio).effectivePlan).store) notFound();

  const product = await getProductBySlug(studio.id, productSlug);
  if (!product || !product.is_active) notFound();
  const prices = await listProductPrices(studio.id, product.id);
  const asset = product.asset_id ? await assetById(studio.id, product.asset_id) : null;
  const img = asset ? asset.web_url ?? asset.url : null;
  const buyerKey = await readBuyerKey();
  const favorited = buyerKey ? (await listFavoriteProductIds(studio.id, buyerKey)).has(product.id) : false;
  const related = await Promise.all(
    (await listRelatedProducts(studio.id, product.id)).map(async (r) => {
      const active = (await listProductPrices(studio.id, r.id)).filter((row) => row.is_active && row.amount_cents > 0);
      const from = active.length ? Math.min(...active.map((row) => effectivePrice(row).priceCents)) : null;
      const a = r.asset_id ? await assetById(studio.id, r.asset_id) : null;
      return { r, from, img: a ? a.thumb_url ?? a.web_url ?? a.url : null };
    })
  );

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="flex items-center justify-between gap-4">
          <Link href="/shop" className="text-sm text-[var(--site-ink-2)] hover:text-[var(--site-ink)]">← Shop</Link>
          <CartLink slug={slug} />
        </div>
        <div className="mt-4 grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
          <div className="overflow-hidden rounded-2xl bg-[var(--site-bg-2)]">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={product.title} className="w-full h-auto object-cover" />
            ) : (
              <div className="aspect-[4/5]" />
            )}
          </div>
          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl sm:text-3xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>{product.title}</h1>
              <FavoriteButton slug={slug} productId={product.id} favorited={favorited} className="shrink-0" />
            </div>
            {product.description ? <p className="mt-3 text-[var(--site-ink-2)]">{product.description}</p> : null}
            <div className="mt-6">
              <BuyForm slug={slug} productId={product.id} productSlug={product.slug} productTitle={product.title} prices={prices} currency={studio.currency} cancelled={sp?.cancelled === "1"} />
            </div>
            {product.license_text ? (
              <details className="mt-6 text-sm">
                <summary className="cursor-pointer text-[var(--site-ink-2)]">Licence &amp; usage</summary>
                <p className="mt-2 whitespace-pre-wrap text-[var(--site-ink-2)]">{product.license_text}</p>
              </details>
            ) : null}
          </div>
        </div>

        {related.length > 0 ? (
          <section className="mt-14 sm:mt-20">
            <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>More from the shop</h2>
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {related.map(({ r, from, img }) => (
                <Link key={r.id} href={`/shop/${r.slug}`} className="group block">
                  <div className="aspect-[4/5] overflow-hidden rounded-xl bg-[var(--site-bg-2)]">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={r.title} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                    ) : null}
                  </div>
                  <div className="mt-2">
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-[var(--site-ink-2)]">{from != null ? `From ${formatMoney(from, studio.currency)}` : "—"}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </Container>
    </div>
  );
}
