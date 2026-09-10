import { db, one, rows } from "@/lib/db";
import { studioBaseUrl } from "@/lib/tenant";
import { parseSite } from "@/lib/site/schema";
import { defaultSite } from "@/lib/site/defaults";
import type { Studio } from "@/lib/types";

/** Per-tenant sitemap; galleries, pay and hub are excluded (plan 14.31). */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const studio = one<Studio>(await db()`select * from studios where slug = ${slug} and deleted_at is null`);
  if (!studio || !studio.site_published_at) return new Response("Not found", { status: 404 });
  const site = parseSite(studio.site, defaultSite(studio.name));
  const base = studioBaseUrl(studio);
  const paths = ["/"];
  if (site.portfolio.enabled) paths.push("/portfolio");
  if (site.pricing.enabled) paths.push("/pricing");
  if (site.about.enabled) paths.push("/about");
  if (site.contact.enabled) paths.push("/contact");
  if (site.areas.enabled) {
    for (const a of rows<{ slug: string }>(await db()`select slug from site_areas where studio_id = ${studio.id} and is_published`)) paths.push(`/headshots/${a.slug}`);
  }
  const now = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map((p) => `  <url><loc>${base}${p}</loc><lastmod>${now}</lastmod></url>`)
    .join("\n")}\n</urlset>`;
  return new Response(body, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
}
