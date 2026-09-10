import { notFound } from "next/navigation";
import { studioBySlug, siteOf } from "@/lib/tenant-data";
import { SiteHeader, SiteFooter } from "@/components/site/sections";
import { LocalBusinessJsonLd } from "@/components/site/json-ld";

/** Full marketing chrome for the public website pages (plan 14.12, 14.13). */
export default async function SiteLayout({ children, params }: LayoutProps<"/t/[slug]">) {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const site = siteOf(studio);
  return (
    <>
      <LocalBusinessJsonLd studio={studio} site={site} />
      <SiteHeader studio={studio} site={site} />
      <main className="flex-1">{children}</main>
      <SiteFooter studio={studio} site={site} />
    </>
  );
}
