import { requireStudioPage } from "@/lib/auth";
import { loadSiteData, siteFromDraft } from "@/lib/site/render";
import { themeCss, googleFontsHref } from "@/lib/site/theme";
import { SiteHeader, SiteFooter, Hero, Intro, PortfolioStrip, PackagesSection, Testimonials, Faq, LocationSection, Cta } from "@/components/site/sections";

export const metadata = { robots: { index: false, follow: false } };

/** Live draft preview for the editor iframe (plan 14.17). Renders inside the studio session. */
export default async function WebsitePreview() {
  const ctx0 = await requireStudioPage("admin");
  const data = await loadSiteData(ctx0.studio);
  const site = siteFromDraft(ctx0.studio); // draft over published
  const ctx = { template: site.settings.template, assets: data.assets };
  const style = Object.fromEntries(themeCss(site.settings).split(";").map((d) => d.split(":") as [string, string]));
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontsHref(site.settings.font)} />
      <div style={style} className="min-h-screen flex flex-col bg-[var(--site-bg)] text-[var(--site-ink)]" data-theme={site.settings.colors.base === "dark" ? "dark" : undefined}>
        <SiteHeader studio={ctx0.studio} site={site} />
        <main className="flex-1">
          <Hero hero={site.home.hero} ctx={ctx} />
          <Intro intro={site.home.intro} ctx={ctx} />
          <PortfolioStrip strip={site.home.portfolioStrip} items={data.portfolio} />
          {site.home.packages.enabled ? <PackagesSection heading={site.home.packages.heading || "Pricing"} body={site.home.packages.body} packages={data.packages.filter((p) => p.is_active)} cur={ctx0.studio.currency} /> : null}
          {site.home.testimonials.enabled ? <Testimonials heading={site.home.testimonials.heading} limit={site.home.testimonials.limit} items={data.testimonials} /> : null}
          {site.home.faq.enabled ? <Faq heading={site.home.faq.heading} items={site.home.faq.items} /> : null}
          <LocationSection location={site.home.location} settings={site.settings} />
          <Cta cta={site.home.cta} ctx={ctx} />
        </main>
        <SiteFooter studio={ctx0.studio} site={site} />
      </div>
    </>
  );
}
