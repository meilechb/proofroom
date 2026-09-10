import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { loadSiteData, assetUrl } from "@/lib/site/render";
import { PageHero, Steps, Cta, Container } from "@/components/site/sections";
import { PersonJsonLd } from "@/components/site/json-ld";

export async function generateMetadata({ params }: PageProps<"/t/[slug]/about">): Promise<Metadata> {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) return {};
  const { site } = await loadSiteData(studio);
  const p = site.seo.pages.about;
  return { title: p?.title || `About | ${studio.name}`, description: p?.description || undefined, robots: { index: true } };
}

export default async function AboutPage({ params }: PageProps<"/t/[slug]/about">) {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const data = await loadSiteData(studio);
  const page = data.site.about;
  if (!page.enabled) notFound();
  const ctx = { template: data.site.settings.template, assets: data.assets };
  const portrait = assetUrl(data.assets, page.bio.portraitAssetId, "web");
  return (
    <>
      <PersonJsonLd studio={studio} name={studio.name} />
      <PageHero heading={page.hero.heading || "About"} subheading={page.hero.subheading} res={assetUrl(data.assets, page.hero.imageAssetId, "full")} />
      {page.bio.enabled && (page.bio.body || portrait) ? (
        <Container className="py-14 grid gap-10 lg:grid-cols-2 lg:items-start">
          {portrait ? <div className="overflow-hidden rounded-2xl lg:order-2">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={portrait.src} alt={portrait.alt} className="w-full object-cover aspect-[4/5]" /></div> : null}
          <div>
            {page.bio.heading ? <h2 className="text-2xl font-semibold mb-3" style={{ fontFamily: "var(--site-font-heading)" }}>{page.bio.heading}</h2> : null}
            <div className="text-[var(--site-ink-2)] leading-relaxed whitespace-pre-line">{page.bio.body}</div>
          </div>
        </Container>
      ) : null}
      {page.steps.enabled ? <Steps heading={page.steps.heading} items={page.steps.items} /> : null}
      <Cta cta={{ ...page.cta, body: undefined }} ctx={ctx} />
    </>
  );
}
