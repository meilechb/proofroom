import { db, one } from "@/lib/db";
import { studioBaseUrl } from "@/lib/tenant";
import type { Studio } from "@/lib/types";

/** Per-tenant robots: allow the website, disallow client areas (plan 14.31). */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const studio = one<Studio>(await db()`select * from studios where slug = ${slug} and deleted_at is null`);
  const published = studio?.site_published_at;
  const base = studio ? studioBaseUrl(studio) : "";
  const body = published
    ? `User-agent: *\nAllow: /\nDisallow: /g\nDisallow: /pay\nDisallow: /my\nDisallow: /u/\nDisallow: /invoice\nDisallow: /receipt\nDisallow: /team\n\nSitemap: ${base}/sitemap.xml\n`
    : `User-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" } });
}
