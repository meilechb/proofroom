"use client";

import { useState } from "react";
import type { ProductPrice } from "@/lib/types";
import { formatMoney, storeLicenseLabels, storeResolutionLabels } from "@/lib/types";
import { bundlePickTotal, effectivePrice, parseVolumeTiers } from "@/lib/store-shared";

const inputClass = "w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 h-11 text-sm";

/**
 * Pick-any bundle: the buyer selects between min and max photos from a gallery
 * at a per-photo price. The picked ids post to /api/store/checkout, which
 * re-validates the gallery membership and recomputes the total server-side.
 */
export function BundlePicker({ slug, productId, price, photos, currency, cancelled }: {
  slug: string;
  productId: string;
  price: ProductPrice;
  photos: { id: string; filename: string }[];
  currency: string;
  cancelled?: boolean;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const base = effectivePrice(price).priceCents;
  const tiers = parseVolumeTiers(price.volume_tiers);
  const min = price.min_pick ?? 1;
  const max = price.max_pick ?? photos.length;
  const atMax = picked.length >= max;

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : atMax ? p : [...p, id]));

  const enough = picked.length >= min && picked.length <= max;
  // With volume tiers the per-photo price falls as more are picked; recomputed
  // server-side at checkout, this is only the live preview.
  const total = bundlePickTotal(picked.length, base, tiers);
  const per = picked.length ? Math.round(total / picked.length) : base;

  if (photos.length === 0) return <p className="text-[var(--site-ink-2)]">This bundle has no photos to choose from yet.</p>;

  return (
    <form method="post" action="/api/store/checkout" className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="resolution" value={price.resolution} />
      <input type="hidden" name="license" value={price.license} />
      <input type="hidden" name="photoIds" value={JSON.stringify(picked)} />

      {cancelled ? <p className="text-sm text-[var(--site-ink-2)]">Your checkout was cancelled — nothing was charged.</p> : null}

      <p className="text-sm text-[var(--site-ink-2)]">
        {storeResolutionLabels[price.resolution]} — {storeLicenseLabels[price.license]} · {formatMoney(per, currency)} each
        {tiers.length ? " · price drops as you add more" : ""} ·
        {" "}pick {min === max ? min : max >= photos.length ? `at least ${min}` : `${min}–${max}`}
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos.map((ph) => {
          const on = picked.includes(ph.id);
          return (
            <button
              key={ph.id}
              type="button"
              onClick={() => toggle(ph.id)}
              aria-pressed={on}
              aria-label={on ? `Remove ${ph.filename}` : `Add ${ph.filename}`}
              disabled={!on && atMax}
              className={`relative aspect-square overflow-hidden rounded-lg bg-[var(--site-bg-2)] ${on ? "ring-2 ring-[var(--site-primary)]" : ""} ${!on && atMax ? "opacity-50" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photo/${ph.id}?size=thumb`} alt={ph.filename} loading="lazy" className="h-full w-full object-cover" />
              {on ? <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--site-primary)] text-[var(--site-primary-ink)] text-xs">✓</span> : null}
            </button>
          );
        })}
      </div>

      <label className="block">
        <span className="block text-sm mb-1">Your email</span>
        <input type="email" name="email" required placeholder="you@example.com" className={inputClass} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <input type="text" name="code" autoCapitalize="characters" placeholder="Promo code" className={`${inputClass} uppercase`} />
        <input type="text" name="gift" autoCapitalize="characters" placeholder="Gift card" className={`${inputClass} uppercase`} />
      </div>

      <button type="submit" disabled={!enough} className="inline-flex items-center justify-center rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] px-4 h-11 text-sm font-medium w-full disabled:opacity-50">
        {picked.length < min ? `Pick ${min - picked.length} more` : `Buy ${picked.length} — ${formatMoney(total, currency)}`}
      </button>
      <p className="text-xs text-[var(--site-ink-2)]">Secure checkout. Your download link is emailed after payment.</p>
    </form>
  );
}
