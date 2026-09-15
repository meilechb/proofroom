import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { listPortfolio, portfolioCategories } from "@/lib/portfolio";
import { listAssets, isReady } from "@/lib/assets";
import { PageHeader, EmptyState } from "@/components/ui";
import { PortfolioManager } from "./portfolio-manager";

export const metadata: Metadata = { title: "Portfolio" };

/** Curate the public portfolio from the asset library (plan 15.5). */
export default async function PortfolioPage() {
  const ctx = await requireStudioPage();
  const [items, assets, categories] = await Promise.all([
    listPortfolio(ctx.studio.id),
    listAssets(ctx.studio.id),
    portfolioCategories(ctx.studio.id),
  ]);
  const inPortfolio = new Set(items.map((i) => i.asset_id));
  const available = assets
    .filter(isReady)
    .filter((a) => !inPortfolio.has(a.id))
    .map((a) => ({ id: a.id, thumb: a.thumb_url ?? a.web_url ?? a.url, filename: a.filename, alt: a.alt }));

  return (
    <div>
      <PageHeader
        title="Portfolio"
        description="The photos shown on your public website. Add them from your asset library, then order and tag them."
      />
      {items.length === 0 && available.length === 0 ? (
        <EmptyState
          title="No portfolio photos yet"
          description="Add some from your assets."
          action={<a href="/studio/assets" className="btn-primary btn-sm">Go to Assets</a>}
        />
      ) : (
        <PortfolioManager initialItems={items} available={available} categories={categories} />
      )}
    </div>
  );
}
