import type { Site, SitePage } from "@/lib/site/schema";

/** Titles, descriptions and structured data for tenant pages (plan 3.70). Pure. */

const PAGE_DEFAULT_TITLES: Record<SitePage, string> = { home: "", portfolio: "Portfolio", pricing: "Pricing", about: "About", contact: "Contact", gallery: "Open your gallery", book: "Book a session" };

export function pageMeta(site: Site, page: SitePage, studioName: string) {
  const override = site.seo.pages[page];
  const siteTitle = site.seo.siteTitle || studioName;
  const title = override?.title?.trim() || (page === "home" ? siteTitle : `${PAGE_DEFAULT_TITLES[page]} | ${studioName}`);
  const description = override?.description?.trim() || site.seo.siteDescription || site.settings.tagline || "";
  return { title, description, noindex: page === "gallery" };
}

export function localBusinessJsonLd(site: Site, studio: { name: string; email: string; phone: string | null }, baseUrl: string, logoUrl: string | null) {
  const a = site.settings.address;
  const hasAddress = Boolean(a.street || a.locality);
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: studio.name,
    url: baseUrl,
    email: studio.email,
    ...(studio.phone ? { telephone: studio.phone } : {}),
    ...(logoUrl ? { image: logoUrl, logo: logoUrl } : {}),
    ...(site.settings.tagline ? { description: site.settings.tagline } : {}),
    ...(hasAddress
      ? { address: { "@type": "PostalAddress", streetAddress: a.street || undefined, addressLocality: a.locality || undefined, addressRegion: a.region || undefined, postalCode: a.postalCode || undefined, addressCountry: a.country || undefined } }
      : {}),
    ...(site.settings.hours ? { openingHours: site.settings.hours } : {}),
    sameAs: Object.values(site.settings.social).filter(Boolean),
  };
}

export function areaSlug(town: string) {
  return town.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/['\u2019]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export function areaCopy(site: Site, town: string) {
  return { heading: site.areas.headingPattern.replace(/\{town\}/g, town), body: site.areas.bodyPattern.replace(/\{town\}/g, town) };
}
