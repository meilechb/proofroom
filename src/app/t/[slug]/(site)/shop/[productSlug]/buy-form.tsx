"use client";

import { useState } from "react";
import type { ProductPrice } from "@/lib/types";
import { formatMoney, storeLicenseLabels, storeResolutionLabels } from "@/lib/types";

export function BuyForm({ slug, productId, prices, currency, cancelled }: { slug: string; productId: string; prices: ProductPrice[]; currency: string; cancelled?: boolean }) {
  const options = prices.filter((p) => p.is_active && p.amount_cents > 0);
  const [sel, setSel] = useState(0);
  const chosen = options[Math.min(sel, options.length - 1)];

  if (options.length === 0) return <p className="text-[var(--site-ink-2)]">Not for sale right now.</p>;

  return (
    <form method="post" action="/api/store/checkout" className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="resolution" value={chosen?.resolution ?? ""} />
      <input type="hidden" name="license" value={chosen?.license ?? ""} />

      {cancelled ? <p className="text-sm text-[var(--site-ink-2)]">Your checkout was cancelled — nothing was charged.</p> : null}

      {options.length > 1 ? (
        <label className="block">
          <span className="block text-sm mb-1">Option</span>
          <select
            value={sel}
            onChange={(e) => setSel(Number(e.target.value))}
            className="w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 h-11 text-sm"
          >
            {options.map((o, i) => (
              <option key={i} value={i}>
                {storeResolutionLabels[o.resolution]} — {storeLicenseLabels[o.license]} · {formatMoney(o.amount_cents, currency)}
              </option>
            ))}
          </select>
        </label>
      ) : chosen ? (
        <p className="text-sm text-[var(--site-ink-2)]">{storeResolutionLabels[chosen.resolution]} — {storeLicenseLabels[chosen.license]}</p>
      ) : null}

      <label className="block">
        <span className="block text-sm mb-1">Your email</span>
        <input type="email" name="email" required placeholder="you@example.com" className="w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 h-11 text-sm" />
      </label>

      <label className="block">
        <span className="block text-sm mb-1 text-[var(--site-ink-2)]">Promo code (optional)</span>
        <input type="text" name="code" autoCapitalize="characters" placeholder="CODE" className="w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 h-11 text-sm uppercase" />
      </label>

      <button type="submit" className="inline-flex items-center justify-center rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] px-4 h-11 text-sm font-medium w-full">
        Buy{chosen ? ` — ${formatMoney(chosen.amount_cents, currency)}` : ""}
      </button>
      <p className="text-xs text-[var(--site-ink-2)]">Secure checkout. Your download link is emailed after payment.</p>
    </form>
  );
}
