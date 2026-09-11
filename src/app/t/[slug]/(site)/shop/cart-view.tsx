"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMoney, storeLicenseLabels, storeResolutionLabels } from "@/lib/types";
import { RM_DIMENSIONS } from "@/lib/store-shared";
import { onCartChange, readCart, removeFromCart, type CartItem } from "./cart-store";

function usageSummary(usage: Record<string, string> | undefined): string {
  if (!usage) return "";
  return RM_DIMENSIONS.map((d) => d.options.find((o) => o.value === usage[d.key])?.label).filter(Boolean).join(" · ");
}

export function CartView({ slug, currency, manual, cancelled }: { slug: string; currency: string; manual?: boolean; cancelled?: boolean }) {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    const update = () => setItems(readCart(slug));
    update();
    return onCartChange(update);
  }, [slug]);

  const subtotal = items.reduce((s, i) => s + (Number.isFinite(i.priceCents) ? i.priceCents : 0), 0);
  const cartJson = JSON.stringify(items.map((i) => ({ productId: i.productId, resolution: i.resolution, license: i.license, ...(i.usage ? { usage: i.usage } : {}) })));

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl sm:text-4xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>Your cart</h1>
        <Link href="/shop" className="text-sm underline text-[var(--site-ink-2)] hover:text-[var(--site-ink)]">Keep shopping</Link>
      </div>
      {cancelled ? <p className="mt-3 text-sm text-[var(--site-ink-2)]">Your checkout was cancelled — nothing was charged.</p> : null}

      {items.length === 0 ? (
        <p className="mt-8 text-[var(--site-ink-2)]">Your cart is empty. <Link href="/shop" className="underline">Browse the shop →</Link></p>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-[var(--site-line)] border-y border-[var(--site-line)]">
            {items.map((i) => (
              <li key={i.key} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <Link href={`/shop/${i.productSlug}`} className="text-sm font-medium hover:underline">{i.title}</Link>
                  <p className="text-xs text-[var(--site-ink-2)]">
                    {storeResolutionLabels[i.resolution]} · {storeLicenseLabels[i.license]}
                    {i.license === "rm" && usageSummary(i.usage) ? ` · ${usageSummary(i.usage)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-sm">{formatMoney(i.priceCents, currency)}</span>
                  <button type="button" aria-label={`Remove ${i.title}`} onClick={() => removeFromCart(slug, i.key)} className="text-[var(--site-ink-2)] hover:text-[var(--site-ink)]">×</button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-[var(--site-ink-2)]">Subtotal</span>
            <span className="font-medium">{formatMoney(subtotal, currency)}</span>
          </div>

          <form method="post" action="/api/store/cart-checkout" className="mt-6 space-y-3">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="cart" value={cartJson} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="block text-sm mb-1">Your email</span>
                <input type="email" name="email" required placeholder="you@example.com" className="w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 h-11 text-sm" />
              </label>
              <label className="block">
                <span className="block text-sm mb-1 text-[var(--site-ink-2)]">Name (optional)</span>
                <input type="text" name="name" className="w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 h-11 text-sm" />
              </label>
              <label className="block">
                <span className="block text-sm mb-1 text-[var(--site-ink-2)]">Promo code</span>
                <input type="text" name="code" autoCapitalize="characters" placeholder="CODE" className="w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 h-11 text-sm uppercase" />
              </label>
              <label className="block">
                <span className="block text-sm mb-1 text-[var(--site-ink-2)]">Gift card</span>
                <input type="text" name="gift" autoCapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX" className="w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 h-11 text-sm uppercase" />
              </label>
            </div>
            <button type="submit" className="inline-flex items-center justify-center rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] px-4 h-11 text-sm font-medium w-full">
              {manual ? "Place order" : `Checkout — ${formatMoney(subtotal, currency)}`}
            </button>
            <p className="text-xs text-[var(--site-ink-2)]">Promo codes and gift cards apply at checkout. Your download link is emailed after payment.</p>
          </form>
        </>
      )}
    </div>
  );
}
