import { notFound } from "next/navigation";
import { studioBySlug, siteOf } from "@/lib/tenant-data";
import { themeCss, googleFontsHref } from "@/lib/site/theme";

export const metadata = { robots: { index: false, follow: false } };

/** Tenant theme wrapper (plan 13.1, 14.14). Chrome is added by the (app) and (site) group layouts. */
export default async function TenantLayout({ children, params }: LayoutProps<"/t/[slug]">) {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const site = siteOf(studio);
  const style = Object.fromEntries(themeCss(site.settings).split(";").map((d) => d.split(":") as [string, string]));
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontsHref(site.settings.font)} />
      <div style={style} className="min-h-screen flex flex-col bg-[var(--site-bg)] text-[var(--site-ink)]" data-theme={site.settings.colors.base === "dark" ? "dark" : undefined}>
        {children}
      </div>
    </>
  );
}
