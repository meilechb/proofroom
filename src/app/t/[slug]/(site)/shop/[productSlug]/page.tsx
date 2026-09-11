import { notFound } from "next/navigation";
import Link from "next/link";
import { studioBySlug } from "@/lib/tenant-data";
import { billingState, entitlements } from "@/lib/plans";
import { storeSettings } from "@/lib/store-shared";
import { getProductBySlug, listFavoriteProductIds, listProductPrices } from "@/lib/store";
import { readBuyerKey } from "@/lib/store-buyer";
import { assetById } from "@/lib/assets";
import { Container } from "@/components/site/sections";
import { BuyForm } from "./buy-form";
import { FavoriteButton } from "../favorite-button";

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

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <Link href="/shop" className="text-sm text-[var(--site-ink-2)] hover:text-[var(--site-ink)]">← Shop</Link>
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
              <BuyForm slug={slug} productId={product.id} prices={prices} currency={studio.currency} cancelled={sp?.cancelled === "1"} />
            </div>
            {product.license_text ? (
              <details className="mt-6 text-sm">
                <summary className="cursor-pointer text-[var(--site-ink-2)]">Licence &amp; usage</summary>
                <p className="mt-2 whitespace-pre-wrap text-[var(--site-ink-2)]">{product.license_text}</p>
              </details>
            ) : null}
          </div>
        </div>
      </Container>
    </div>
  );
}
