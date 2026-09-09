import { NextResponse, type NextRequest } from "next/server";
import { classifyHost } from "@/lib/tenant";

/**
 * Edge of the app. Three jobs:
 *  1. Tenant hosts ({slug}.APP_DOMAIN and verified custom domains) are rewritten
 *     to /t/{slug}/... so one route tree serves every studio.
 *  2. Non-production hosts get X-Robots-Tag: noindex.
 *  3. Optimistic redirect to /login for /studio and /admin when there is no
 *     session cookie. Real authorization happens in lib/auth.ts on every request.
 */

const SESSION_COOKIE = "pr_session";
const ROOT_ONLY_PREFIXES = ["/studio", "/admin", "/login", "/signup", "/api/billing", "/api/stripe", "/api/lr", "/api/connect", "/api/cron", "/api/health"];

// Custom-domain lookups are cached per instance for a minute.
const domainCache = new Map<string, { slug: string | null; until: number }>();
// Platform maintenance banner text, cached per instance for a minute (plan 4.3).
let bannerCache: { text: string | null; until: number } = { text: null, until: 0 };

async function maintenanceBanner(): Promise<string | null> {
  if (bannerCache.until > Date.now()) return bannerCache.text;
  let text: string | null = null;
  const url = process.env.DATABASE_URL;
  if (url) {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(url);
      const rows = await sql`select value->>'text' as text from platform_settings where key = 'maintenance_banner' limit 1`;
      text = (rows[0] as { text: string | null } | undefined)?.text?.trim() || null;
    } catch {
      text = null;
    }
  }
  bannerCache = { text, until: Date.now() + 60_000 };
  return text;
}

async function slugForCustomDomain(host: string): Promise<string | null> {
  const cached = domainCache.get(host);
  if (cached && cached.until > Date.now()) return cached.slug;
  let slug: string | null = null;
  const url = process.env.DATABASE_URL;
  if (url) {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(url);
      const rows = await sql`select slug from studios where lower(custom_domain) = ${host} and custom_domain_verified_at is not null and deleted_at is null limit 1`;
      slug = (rows[0] as { slug: string } | undefined)?.slug ?? null;
    } catch {
      slug = null;
    }
  }
  domainCache.set(host, { slug, until: Date.now() + 60_000 });
  return slug;
}

function isProductionHost(request: NextRequest) {
  const root = (process.env.NEXT_PUBLIC_APP_DOMAIN ?? "").toLowerCase().split(":")[0];
  const host = (request.headers.get("host") ?? "").toLowerCase().split(":")[0];
  return Boolean(root) && (host === root || host.endsWith(`.${root}`));
}

function finish(request: NextRequest, response: NextResponse, tenant = false) {
  if (!isProductionHost(request) || tenant) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

/** Request headers server components can read via headers(): which tenant, on which host (plan 4.2). */
function withTenantHeaders(request: NextRequest, slug: string | null) {
  const headers = new Headers(request.headers);
  if (slug) headers.set("x-tenant-slug", slug);
  headers.set("x-tenant-host", request.headers.get("host") ?? "");
  return headers;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const kind = classifyHost(request.headers.get("host"), process.env.NEXT_PUBLIC_APP_DOMAIN);

  // Tenant hosts: rewrite everything except assets/API into the tenant tree.
  if (kind.kind !== "root") {
    const slug = kind.kind === "subdomain" ? kind.slug : await slugForCustomDomain(kind.host);
    if (!slug) {
      const url = request.nextUrl.clone();
      url.pathname = "/studio-not-found";
      return finish(request, NextResponse.rewrite(url), true);
    }
    if (pathname.startsWith("/api/photo") || pathname.startsWith("/api/gallery") || pathname.startsWith("/api/pay") || pathname.startsWith("/api/track")) {
      return finish(request, NextResponse.next({ request: { headers: withTenantHeaders(request, slug) } }), true);
    }
    if (ROOT_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      const proto = request.nextUrl.protocol;
      const root = process.env.NEXT_PUBLIC_APP_DOMAIN ?? request.nextUrl.host;
      return NextResponse.redirect(`${proto}//${root}${pathname}${request.nextUrl.search}`);
    }
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith("/t/") ? pathname : `/t/${slug}${pathname === "/" ? "" : pathname}`;
    return finish(request, NextResponse.rewrite(url, { request: { headers: withTenantHeaders(request, slug) } }), true);
  }

  // Root host: optimistic auth for the app areas.
  if (pathname.startsWith("/studio") || pathname.startsWith("/admin")) {
    if (!request.cookies.get(SESSION_COOKIE)?.value) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return finish(request, NextResponse.redirect(url));
    }
    const headers = withTenantHeaders(request, null);
    const banner = await maintenanceBanner();
    if (banner) headers.set("x-maintenance-banner", banner);
    return finish(request, NextResponse.next({ request: { headers } }));
  }
  // Tenant pages viewed directly on the root host are never indexed.
  const pathSlug = pathname.startsWith("/t/") ? pathname.split("/")[2] ?? null : null;
  return finish(request, NextResponse.next({ request: { headers: withTenantHeaders(request, pathSlug) } }), pathname.startsWith("/t/"));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|downloads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
