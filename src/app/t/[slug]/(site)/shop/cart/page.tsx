import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { billingState, entitlements } from "@/lib/plans";
import { effectivePrice, storeSettings } from "@/lib/store-shared";
import { listProductPrices, listProducts } from "@/lib/store";
import { assetById } from "@/lib/assets";
import { Container } from "@/components/site/sections";
import { CartView, type Suggestion } from "../cart-view";

export const metadata = { title: "Cart", robots: { index: false, follow: false } };

const SELLABLE = ["image", "bundle", "gallery_unlock", "collection_unlock", "digital"];

export default async function CartPage({ params, searchParams }: PageProps<"/t/[slug]/shop/cart">) {
  const { slug } = await params;
  const sp = await searchParams;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const settings = storeSettings((studio.settings ?? {}) as Record<string, unknown>);
  if (!settings.enabled || !entitlements(billingState(studio).effectivePlan).store) notFound();

  // A few other priced products to cross-sell at the cart; the client filters
  // out anything already in the cart and shows at most four.
  const candidates = (await listProducts(studio.id, { activeOnly: true })).filter((p) => SELLABLE.includes(p.kind)).slice(0, 8);
  const suggestions = (
    await Promise.all(
      candidates.map(async (p): Promise<Suggestion | null> => {
        const active = (await listProductPrices(studio.id, p.id)).filter((r) => r.is_active && r.amount_cents > 0);
        if (!active.length) return null;
        const asset = p.asset_id ? await assetById(studio.id, p.asset_id) : null;
        return { id: p.id, slug: p.slug, title: p.title, from: Math.min(...active.map((r) => effectivePrice(r).priceCents)), img: asset ? asset.thumb_url ?? asset.web_url ?? asset.url : null };
      })
    )
  ).filter((s): s is Suggestion => s !== null);

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <CartView slug={slug} currency={studio.currency} manual={settings.paymentMode === "manual"} cancelled={sp?.cancelled === "1"} suggestions={suggestions} />
      </Container>
    </div>
  );
}
