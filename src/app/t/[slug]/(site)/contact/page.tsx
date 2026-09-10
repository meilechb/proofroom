import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { loadSiteData, assetUrl } from "@/lib/site/render";
import { PageHero, Container } from "@/components/site/sections";
import { ContactForm } from "./contact-form";

export async function generateMetadata({ params }: PageProps<"/t/[slug]/contact">): Promise<Metadata> {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) return {};
  const { site } = await loadSiteData(studio);
  const p = site.seo.pages.contact;
  return { title: p?.title || `Contact | ${studio.name}`, description: p?.description || undefined, robots: { index: true } };
}

export default async function ContactPage({ params }: PageProps<"/t/[slug]/contact">) {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const data = await loadSiteData(studio);
  const page = data.site.contact;
  if (!page.enabled) notFound();
  const a = data.site.settings.address;
  const packages = data.packages.filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.name }));

  return (
    <>
      <PageHero heading={page.hero.heading || "Contact"} subheading={page.hero.subheading} res={assetUrl(data.assets, page.hero.imageAssetId, "full")} />
      <Container className="py-14 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <ContactForm slug={slug} packages={packages} showPackagePicker={page.form.showPackagePicker} showPhone={page.form.showPhone} showPreferredDate={page.form.showPreferredDate} successMessage={page.form.successMessage} />
        </div>
        {page.details.enabled ? (
          <div className="text-sm text-[var(--site-ink-2)] space-y-4">
            <div><p className="font-medium text-[var(--site-ink)]">Email</p><a href={`mailto:${studio.email}`} className="underline">{studio.email}</a></div>
            {studio.phone ? <div><p className="font-medium text-[var(--site-ink)]">Phone</p><p>{studio.phone}</p></div> : null}
            {page.details.showAddress && (a.street || a.locality) ? <div><p className="font-medium text-[var(--site-ink)]">Studio</p><p>{[a.street, a.locality, a.region, a.postalCode].filter(Boolean).join(", ")}</p>{page.details.showMap && a.mapUrl ? <a href={a.mapUrl} target="_blank" rel="noopener" className="underline">Get directions</a> : null}</div> : null}
            {page.details.showHours && data.site.settings.hours ? <div><p className="font-medium text-[var(--site-ink)]">Hours</p><p className="whitespace-pre-line">{data.site.settings.hours}</p></div> : null}
          </div>
        ) : null}
      </Container>
    </>
  );
}
