import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { billingState, entitlements } from "@/lib/plans";
import { storeSettings } from "@/lib/store-shared";
import { Container } from "@/components/site/sections";
import { CartView } from "../cart-view";

export const metadata = { title: "Cart", robots: { index: false, follow: false } };

export default async function CartPage({ params, searchParams }: PageProps<"/t/[slug]/shop/cart">) {
  const { slug } = await params;
  const sp = await searchParams;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const settings = storeSettings((studio.settings ?? {}) as Record<string, unknown>);
  if (!settings.enabled || !entitlements(billingState(studio).effectivePlan).store) notFound();

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <CartView slug={slug} currency={studio.currency} manual={settings.paymentMode === "manual"} cancelled={sp?.cancelled === "1"} />
      </Container>
    </div>
  );
}
