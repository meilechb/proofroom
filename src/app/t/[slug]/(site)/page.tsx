import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { loadSiteData } from "@/lib/site/render";
import { Hero, Intro, PortfolioStrip, PackagesSection, Testimonials, Faq, LocationSection, Cta } from "@/components/site/sections";

export async function generateMetadata({ params }: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) return {};
  const { site } = await loadSiteData(studio);
  return { title: site.seo.siteTitle || studio.name, description: site.seo.siteDescription || undefined, robots: { index: true } };
}

export default async function TenantHome({ params }: PageProps<"/t/[slug]">) {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const data = await loadSiteData(studio);
  const { site } = data;
  const ctx = { template: site.settings.template, assets: data.assets };
  const cur = studio.currency;
  return (
    <>
      <Hero hero={site.home.hero} ctx={ctx} />
      <Intro intro={site.home.intro} ctx={ctx} />
      <PortfolioStrip
        strip={site.home.portfolioStrip}
        items={(() => {
          const feat = data.portfolio.filter((p) => p.is_featured);
          return site.home.portfolioStrip.featuredOnly && feat.length >= 3 ? feat : data.portfolio;
        })()}
      />
      {site.home.packages.enabled ? <PackagesSection heading={site.home.packages.heading || "Pricing"} body={site.home.packages.body} packages={data.packages.filter((p) => p.is_active)} cur={cur} /> : null}
      {site.home.testimonials.enabled ? <Testimonials heading={site.home.testimonials.heading} limit={site.home.testimonials.limit} items={data.testimonials} /> : null}
      {site.home.faq.enabled ? <Faq heading={site.home.faq.heading} items={site.home.faq.items} /> : null}
      <LocationSection location={site.home.location} settings={site.settings} />
      <Cta cta={site.home.cta} ctx={ctx} />
    </>
  );
}
