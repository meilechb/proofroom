import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { loadSiteData, assetUrl } from "@/lib/site/render";
import { PageHero, Cta, Container } from "@/components/site/sections";
import { PortfolioGrid } from "./portfolio-grid";

export async function generateMetadata({ params }: PageProps<"/t/[slug]/portfolio">): Promise<Metadata> {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) return {};
  const { site } = await loadSiteData(studio);
  const p = site.seo.pages.portfolio;
  return { title: p?.title || `Portfolio | ${studio.name}`, description: p?.description || undefined, robots: { index: true } };
}

export default async function PortfolioPage({ params }: PageProps<"/t/[slug]/portfolio">) {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const data = await loadSiteData(studio);
  const page = data.site.portfolio;
  if (!page.enabled) notFound();
  const ctx = { template: data.site.settings.template, assets: data.assets };
  const items = data.portfolio.slice(0, page.grid.limit);
  return (
    <>
      <PageHero heading={page.hero.heading || "Portfolio"} subheading={page.hero.subheading} res={assetUrl(data.assets, page.hero.imageAssetId, "full")} />
      <Container className="py-12">
        {items.length === 0 ? <p className="text-[var(--site-ink-2)]">Work will appear here soon.</p> : <PortfolioGrid items={items} categories={data.categories} showFilters={page.grid.showFilters} />}
      </Container>
      <Cta cta={{ ...page.cta, body: undefined }} ctx={ctx} />
    </>
  );
}
