import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { loadSiteData, assetUrl } from "@/lib/site/render";
import { PageHero, PackagesSection, IncludedList, Faq, Cta } from "@/components/site/sections";

export async function generateMetadata({ params }: PageProps<"/t/[slug]/pricing">): Promise<Metadata> {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) return {};
  const { site } = await loadSiteData(studio);
  const p = site.seo.pages.pricing;
  return { title: p?.title || `Pricing | ${studio.name}`, description: p?.description || undefined, robots: { index: true } };
}

export default async function PricingPage({ params }: PageProps<"/t/[slug]/pricing">) {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const data = await loadSiteData(studio);
  const page = data.site.pricing;
  if (!page.enabled) notFound();
  const ctx = { template: data.site.settings.template, assets: data.assets };
  return (
    <>
      <PageHero heading={page.hero.heading || "Pricing"} subheading={page.hero.subheading} res={assetUrl(data.assets, page.hero.imageAssetId, "full")} />
      <PackagesSection body={page.packages.body} packages={data.packages.filter((p) => p.is_active)} buttonLabel={page.packages.buttonLabel || "Book"} cur={studio.currency} />
      <IncludedList heading={page.included.heading} items={page.included.items} />
      {page.faq.enabled ? <Faq heading={page.faq.heading} items={page.faq.items} /> : null}
      <Cta cta={{ ...page.cta, body: undefined }} ctx={ctx} />
    </>
  );
}
