"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProductPrice } from "@/lib/types";
import { formatDate, formatMoney, storeLicenseLabels, storeResolutionLabels } from "@/lib/types";
import { effectivePrice, resolveStorePrice, RM_DIMENSIONS } from "@/lib/store-shared";
import { addToCart, itemKey } from "../cart-store";

const selectClass = "w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 h-11 text-sm";

export function BuyForm({ slug, productId, productSlug, productTitle, prices, currency, cancelled, kind }: { slug: string; productId: string; productSlug: string; productTitle: string; prices: ProductPrice[]; currency: string; cancelled?: boolean; kind?: string }) {
  const options = prices.filter((p) => p.is_active && p.amount_cents > 0);
  // A gallery/collection unlock expands into many files only in the single "buy
  // now" checkout, so it can't go through the per-line cart.
  const isUnlock = kind === "gallery_unlock" || kind === "collection_unlock";
  const [sel, setSel] = useState(0);
  const [usage, setUsage] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);
  const chosen = options[Math.min(sel, options.length - 1)];

  if (options.length === 0) return <p className="text-[var(--site-ink-2)]">Not for sale right now.</p>;

  const isRm = chosen?.license === "rm";
  const priced = chosen ? resolveStorePrice(prices, chosen.resolution, chosen.license, usage) : null;
  const quote = !!priced && "quote" in priced;
  const priceCents = priced && "amountCents" in priced ? priced.amountCents : null;
  // Struck-through "was" price for a non-rm option currently on sale.
  const compareAt = chosen && !isRm ? effectivePrice(chosen).compareAtCents : null;
  const saleEnds = compareAt != null && chosen?.sale_ends_at && new Date(chosen.sale_ends_at) > new Date() ? chosen.sale_ends_at : null;

  const add = () => {
    if (!chosen || priceCents == null) return;
    const keyExtra = isRm ? ":" + RM_DIMENSIONS.map((d) => usage[d.key] ?? "").join("-") : "";
    addToCart(slug, {
      key: itemKey(productId, chosen.resolution, chosen.license) + keyExtra,
      productId,
      productSlug,
      title: productTitle,
      resolution: chosen.resolution,
      license: chosen.license,
      priceCents,
      usage: isRm ? { ...usage } : undefined,
    });
    setAdded(true);
  };

  return (
    <form method="post" action="/api/store/checkout" className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="resolution" value={chosen?.resolution ?? ""} />
      <input type="hidden" name="license" value={chosen?.license ?? ""} />
      {isRm ? RM_DIMENSIONS.map((d) => <input key={d.key} type="hidden" name={`u_${d.key}`} value={usage[d.key] ?? ""} />) : null}

      {cancelled ? <p className="text-sm text-[var(--site-ink-2)]">Your checkout was cancelled — nothing was charged.</p> : null}

      {options.length > 1 ? (
        <label className="block">
          <span className="block text-sm mb-1">Option</span>
          <select value={sel} onChange={(e) => setSel(Number(e.target.value))} className={selectClass}>
            {options.map((o, i) => (
              <option key={i} value={i}>
                {storeResolutionLabels[o.resolution]} — {storeLicenseLabels[o.license]} · {o.license === "rm" ? `from ${formatMoney(o.amount_cents, currency)}` : formatMoney(effectivePrice(o).priceCents, currency)}
              </option>
            ))}
          </select>
        </label>
      ) : chosen ? (
        <p className="text-sm text-[var(--site-ink-2)]">{storeResolutionLabels[chosen.resolution]} — {storeLicenseLabels[chosen.license]}</p>
      ) : null}

      {isRm ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {RM_DIMENSIONS.map((d) => (
            <label key={d.key} className="block">
              <span className="block text-xs mb-1 text-[var(--site-ink-2)]">{d.label}</span>
              <select value={usage[d.key] ?? ""} onChange={(e) => setUsage((u) => ({ ...u, [d.key]: e.target.value }))} className={selectClass}>
                <option value="">Choose…</option>
                {d.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      <label className="block">
        <span className="block text-sm mb-1">Your email</span>
        <input type="email" name="email" required placeholder="you@example.com" className={selectClass} />
      </label>

      <label className="block">
        <span className="block text-sm mb-1 text-[var(--site-ink-2)]">Promo code (optional)</span>
        <input type="text" name="code" autoCapitalize="characters" placeholder="CODE" className={`${selectClass} uppercase`} />
      </label>

      <label className="block">
        <span className="block text-sm mb-1 text-[var(--site-ink-2)]">Gift card (optional)</span>
        <input type="text" name="gift" autoCapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX" className={`${selectClass} uppercase`} />
      </label>

      {quote ? (
        <div className="rounded-lg border border-[var(--site-line)] p-3 text-sm text-[var(--site-ink-2)]">
          This licence is priced on request.{" "}
          <Link href="/contact" className="underline">Request a quote →</Link>
        </div>
      ) : (
        <>
          {compareAt != null && priceCents != null ? (
            <p className="text-sm text-[var(--site-ink-2)]"><s>{formatMoney(compareAt, currency)}</s> <span className="font-medium text-[var(--site-ink)]">{formatMoney(priceCents, currency)}</span> · on sale{saleEnds ? ` — ends ${formatDate(saleEnds)}` : ""}</p>
          ) : null}
          <button type="submit" disabled={priceCents == null} className="inline-flex items-center justify-center rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] px-4 h-11 text-sm font-medium w-full disabled:opacity-50">
            Buy now{priceCents != null ? ` — ${formatMoney(priceCents, currency)}` : ""}
          </button>
          {!isUnlock ? (
            <button type="button" onClick={add} disabled={priceCents == null} className="inline-flex items-center justify-center rounded-lg border border-[var(--site-line)] px-4 h-11 text-sm font-medium w-full hover:bg-[var(--site-bg-2)] disabled:opacity-50">
              Add to cart
            </button>
          ) : null}
        </>
      )}
      {added ? (
        <p className="text-xs text-[var(--site-ink-2)]" role="status">Added. <Link href="/shop/cart" className="underline">View cart →</Link></p>
      ) : (
        <p className="text-xs text-[var(--site-ink-2)]">Secure checkout. Your download link is emailed after payment.</p>
      )}
    </form>
  );
}
