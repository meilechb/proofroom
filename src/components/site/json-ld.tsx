import type { Studio } from "@/lib/types";
import type { Site } from "@/lib/site/schema";
import { studioBaseUrl } from "@/lib/tenant";

/**
 * A JSON-LD <script>. `<` is escaped to `<` so a `</script>` inside a
 * (studio-controlled) string can never break out of the script element — the
 * standard XSS guard for embedded JSON.
 */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** LocalBusiness structured data for the studio's public site (plan 14.32). */
export function LocalBusinessJsonLd({ studio, site }: { studio: Studio; site: Site }) {
  const base = studioBaseUrl(studio);
  const a = site.settings.address;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: studio.name,
    url: base,
    email: studio.email,
    ...(studio.phone ? { telephone: studio.phone } : {}),
    ...(site.settings.tagline ? { description: site.settings.tagline } : {}),
    ...(studio.logo_url ? { logo: studio.logo_url } : {}),
    ...(a.street || a.locality ? { address: { "@type": "PostalAddress", streetAddress: a.street || undefined, addressLocality: a.locality || undefined, addressRegion: a.region || undefined, postalCode: a.postalCode || undefined } } : {}),
    sameAs: Object.values(site.settings.social).filter(Boolean),
  };
  return <JsonLd data={data} />;
}

/** Person structured data for the About page (plan 14.32). */
export function PersonJsonLd({ studio, name }: { studio: Studio; name: string }) {
  const data = { "@context": "https://schema.org", "@type": "Person", name, worksFor: { "@type": "Organization", name: studio.name }, url: `${studioBaseUrl(studio)}/about` };
  return <JsonLd data={data} />;
}
