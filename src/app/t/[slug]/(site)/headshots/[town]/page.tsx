import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { loadSiteData } from "@/lib/site/render";
import { db, one } from "@/lib/db";
import { PageHero, PortfolioStrip, PackagesSection, Faq, Cta, Container } from "@/components/site/sections";

type Area = { town: string; slug: string; intro_override: string | null };

async function loadArea(studioId: string, townSlug: string) {
  return one<Area>(await db()`select town, slug, intro_override from site_areas where studio_id = ${studioId} and slug = ${townSlug} and is_published`);
}

export async function generateMetadata({ params }: PageProps<"/t/[slug]/headshots/[town]">): Promise<Metadata> {
  const { slug, town } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) return {};
  const { site } = await loadSiteData(studio);
  if (!site.areas.enabled) return {};
  const area = await loadArea(studio.id, town);
  if (!area) return {};
  return { title: site.areas.headingPattern.replace(/\{town\}/g, area.town) || `Headshots in ${area.town}`, description: site.areas.bodyPattern.replace(/\{town\}/g, area.town).slice(0, 170), robots: { index: true } };
}

export default async function AreaPage({ params }: PageProps<"/t/[slug]/headshots/[town]">) {
  const { slug, town } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const data = await loadSiteData(studio);
  if (!data.site.areas.enabled) notFound();
  const area = await loadArea(studio.id, town);
  if (!area) notFound();
  const ctx = { template: data.site.settings.template, assets: data.assets };
  const heading = (data.site.areas.headingPattern || "Headshots in {town}").replace(/\{town\}/g, area.town);
  const body = (area.intro_override || data.site.areas.bodyPattern || "").replace(/\{town\}/g, area.town);

  return (
    <>
      <PageHero heading={heading} />
      {body ? <Container className="py-12"><p className="max-w-3xl text-[var(--site-ink-2)] leading-relaxed whitespace-pre-line">{body}</p></Container> : null}
      <PortfolioStrip strip={{ enabled: true, heading: "Recent work", limit: 6, featuredOnly: true }} items={data.portfolio.filter((p) => p.is_featured).length >= 3 ? data.portfolio.filter((p) => p.is_featured) : data.portfolio} />
      <PackagesSection heading="Packages" packages={data.packages.filter((p) => p.is_active)} cur={studio.currency} />
      {data.site.pricing.faq.enabled ? <Faq heading="Questions" items={data.site.pricing.faq.items} /> : null}
      <Cta cta={{ enabled: true, heading: `Book your ${area.town} session`, button: { label: "Get in touch", target: "contact" } }} ctx={ctx} />
    </>
  );
}
