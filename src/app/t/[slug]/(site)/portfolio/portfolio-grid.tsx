"use client";

import { useState } from "react";
import type { PortfolioItem } from "@/lib/site/render";
import { Lightbox, type LightboxPhoto } from "@/components/ui/lightbox";

/** Filterable portfolio grid with lightbox (plan 14.5). */
export function PortfolioGrid({ items, categories, showFilters }: { items: PortfolioItem[]; categories: string[]; showFilters: boolean }) {
  const [cat, setCat] = useState<string>("all");
  const [index, setIndex] = useState<number | null>(null);
  const shown = cat === "all" ? items : items.filter((p) => p.category === cat);
  const photos: LightboxPhoto[] = shown.map((p) => ({ id: p.id, src: p.url, alt: p.alt || p.caption || "", width: p.width, height: p.height }));

  return (
    <div>
      {showFilters && categories.length > 1 ? (
        <div className="flex flex-wrap gap-2 mb-6">
          <Chip active={cat === "all"} onClick={() => setCat("all")}>All</Chip>
          {categories.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
        </div>
      ) : null}
      <ul className="columns-2 sm:columns-3 gap-3 [&>li]:mb-3">
        {shown.map((p, i) => (
          <li key={p.id} className="break-inside-avoid">
            <button type="button" onClick={() => setIndex(i)} className="block w-full overflow-hidden rounded-xl bg-[var(--site-bg-2)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumb_url ?? p.url} alt={p.alt || p.caption || ""} loading="lazy" className="w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <Lightbox photos={photos} index={index} onClose={() => setIndex(null)} onIndexChange={setIndex} />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={active ? "rounded-full bg-[var(--site-primary)] text-[var(--site-primary-ink)] px-3 py-1 text-sm capitalize" : "rounded-full border border-[var(--site-line)] px-3 py-1 text-sm capitalize text-[var(--site-ink-2)]"}>{children}</button>;
}
