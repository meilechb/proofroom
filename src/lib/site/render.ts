import "server-only";

import { db, one, rows } from "@/lib/db";
import type { Studio } from "@/lib/types";
import type { Package } from "@/lib/types";
import { parseSite, type Site } from "@/lib/site/schema";
import { defaultSite } from "@/lib/site/defaults";

export type SiteAsset = { id: string; url: string; web_url: string | null; thumb_url: string | null; alt: string; width: number | null; height: number | null };
export type PortfolioItem = { id: string; asset_id: string; category: string; caption: string | null; is_featured: boolean; url: string; thumb_url: string | null; alt: string; width: number | null; height: number | null };
export type Testimonial = { id: string; name: string; body: string; rating: number | null; source: string | null };

export type SiteData = {
  site: Site;
  assets: Map<string, SiteAsset>;
  portfolio: PortfolioItem[];
  categories: string[];
  packages: Package[];
  testimonials: Testimonial[];
};

/** Everything needed to render a studio's public website (plan 14.4-14.16). */
export async function loadSiteData(studio: Studio): Promise<SiteData> {
  const site = parseSite(studio.site, defaultSite(studio.name));
  const [assetRows, portfolio, packages, testimonials] = await Promise.all([
    rows<SiteAsset>(await db()`select id, url, web_url, thumb_url, alt, width, height from assets where studio_id = ${studio.id} and kind in ('image','logo')`),
    rows<PortfolioItem>(await db()`
      select pi.id, pi.asset_id, pi.category, pi.caption, pi.is_featured, a.url, a.thumb_url, a.alt, a.width, a.height
      from portfolio_items pi join assets a on a.id = pi.asset_id
      where pi.studio_id = ${studio.id} and pi.is_published order by pi.sort_order, pi.created_at`),
    rows<Package>(await db()`select * from packages where studio_id = ${studio.id} and is_active order by sort_order, created_at`),
    rows<Testimonial>(await db()`select id, name, body, rating, source from reviews where studio_id = ${studio.id} and is_published order by sort_order, created_at`),
  ]);
  const assets = new Map(assetRows.map((a) => [a.id, a]));
  const categories = Array.from(new Set(portfolio.map((p) => p.category))).sort();
  return { site, assets, portfolio, categories, packages, testimonials };
}

/** Draft variant for the editor preview (plan 14.17). */
export function siteFromDraft(studio: Studio): Site {
  const fallback = parseSite(studio.site, defaultSite(studio.name));
  return studio.site_draft ? parseSite(studio.site_draft, fallback) : fallback;
}

export function assetUrl(assets: Map<string, SiteAsset>, id: string | null | undefined, prefer: "web" | "thumb" | "full" = "web") {
  if (!id) return null;
  const a = assets.get(id);
  if (!a) return null;
  const url = prefer === "thumb" ? a.thumb_url ?? a.web_url ?? a.url : prefer === "full" ? a.url : a.web_url ?? a.url;
  return { src: url, alt: a.alt || "", width: a.width, height: a.height };
}
