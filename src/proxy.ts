import { NextResponse, type NextRequest } from "next/server";
import { classifyHost } from "@/lib/tenant";

/**
 * Edge of the app. Three jobs:
 *  1. Tenant hosts ({slug}.APP_DOMAIN and verified custom domains) are rewritten
 *     to /t/{slug}/... so one route tree serves every studio.
 *  2. Non-production hosts and tenant pages viewed on the root host under
 *     /t/{slug} get X-Robots-Tag: noindex. Studio subdomains and verified custom
 *     domains are indexable; each tenant's own robots route decides the rest.
 *  3. Optimistic redirect to /login for /studio and /admin when there is no
 *     session cookie. Real authorization happens in lib/auth.ts on every request.
 *     While a session cookie is present its expiry is pushed out, so the cookie
 *     lives as long as the rolling database session it points to.
 *  4. On the root host the /t/{slug} path form (local dev and previews) sets a
 *     short-lived pr_tenant cookie, and the tenant app's root-relative links
 *     (/g/..., /pay/..., /my/...) are rewritten back under /t/{slug}.
 */

const SESSION_COOKIE = "pr_session";
const SESSION_COOKIE_MAX_AGE = 30 * 86400;
const TENANT_PATH_COOKIE = "pr_tenant";
// Tenant-app paths that only exist inside /t/{slug}; on the root host these are
// followed back into the tenant tree when a pr_tenant cookie says which one.
const TENANT_APP_PREFIXES = ["/g", "/pay", "/my", "/invoice", "/receipt", "/book", "/team", "/u", "/headshots", "/api/gallery", "/api/photo", "/api/pay", "/api/track"];
const ROOT_ONLY_PREFIXES = ["/studio", "/admin", "/login", "/signup", "/api/billing", "/api/stripe", "/api/lr", "/api/connect", "/api/cron", "/api/health", "/api/resend", "/api/data", "/api/plugin"];

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

function finish(request: NextRequest, response: NextResponse, opts: { noindex?: boolean; tenantHost?: boolean } = {}) {
  // A verified custom domain is not under APP_DOMAIN but is still production.
  const production = opts.tenantHost ? Boolean(process.env.NEXT_PUBLIC_APP_DOMAIN) : isProductionHost(request);
  if (!production || opts.noindex) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function refreshSessionCookie(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return response;
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
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
    // Custom domains: send www. to the apex (plan 14.34).
    if (kind.kind === "custom" && kind.host.startsWith("www.")) {
      return NextResponse.redirect(`${request.nextUrl.protocol}//${kind.host.slice(4)}${pathname}${request.nextUrl.search}`, 308);
    }
    const slug = kind.kind === "subdomain" ? kind.slug : await slugForCustomDomain(kind.host);
    if (!slug) {
      const url = request.nextUrl.clone();
      url.pathname = "/studio-not-found";
      return finish(request, NextResponse.rewrite(url), { noindex: true, tenantHost: true });
    }
    if (pathname.startsWith("/api/photo") || pathname.startsWith("/api/gallery") || pathname.startsWith("/api/pay") || pathname.startsWith("/api/track")) {
      return finish(request, NextResponse.next({ request: { headers: withTenantHeaders(request, slug) } }), { tenantHost: true });
    }
    if (ROOT_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      const proto = request.nextUrl.protocol;
      const root = process.env.NEXT_PUBLIC_APP_DOMAIN ?? request.nextUrl.host;
      return NextResponse.redirect(`${proto}//${root}${pathname}${request.nextUrl.search}`);
    }
    if (pathname === "/sitemap.xml" || pathname === "/robots.txt") {
      const tenantUrl = request.nextUrl.clone();
      tenantUrl.pathname = `/t/${slug}${pathname === "/sitemap.xml" ? "/sitemap" : "/robots"}`;
      return finish(request, NextResponse.rewrite(tenantUrl, { request: { headers: withTenantHeaders(request, slug) } }), { tenantHost: true });
    }
    // /t/{slug}/... typed on a tenant host: send to the canonical short path. A
    // different slug is not served from this host at all.
    if (pathname === `/t/${slug}` || pathname.startsWith(`/t/${slug}/`)) {
      const canonical = request.nextUrl.clone();
      canonical.pathname = pathname.slice(`/t/${slug}`.length) || "/";
      return NextResponse.redirect(canonical, 308);
    }
    if (pathname === "/t" || pathname.startsWith("/t/")) {
      const url = request.nextUrl.clone();
      url.pathname = "/studio-not-found";
      return finish(request, NextResponse.rewrite(url), { noindex: true, tenantHost: true });
    }
    const url = request.nextUrl.clone();
    url.pathname = `/t/${slug}${pathname === "/" ? "" : pathname}`;
    return finish(request, NextResponse.rewrite(url, { request: { headers: withTenantHeaders(request, slug) } }), { tenantHost: true });
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
    return refreshSessionCookie(request, finish(request, NextResponse.next({ request: { headers } })));
  }
  // Tenant pages viewed directly on the root host are never indexed. Remember
  // which tenant so the app's root-relative links keep working on this form.
  const pathSlug = pathname.startsWith("/t/") ? pathname.split("/")[2] ?? null : null;
  if (pathSlug && /^[a-z0-9-]{1,80}$/.test(pathSlug)) {
    const response = finish(request, NextResponse.next({ request: { headers: withTenantHeaders(request, pathSlug) } }), { noindex: true });
    response.cookies.set(TENANT_PATH_COOKIE, pathSlug, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 });
    return response;
  }
  const remembered = request.cookies.get(TENANT_PATH_COOKIE)?.value ?? null;
  if (remembered && /^[a-z0-9-]{1,80}$/.test(remembered) && TENANT_APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    // The tenant API routes live at the root and read x-tenant-slug; pages live under /t/{slug}.
    if (pathname.startsWith("/api/")) {
      return finish(request, NextResponse.next({ request: { headers: withTenantHeaders(request, remembered) } }), { noindex: true });
    }
    const url = request.nextUrl.clone();
    url.pathname = `/t/${remembered}${pathname}`;
    return finish(request, NextResponse.rewrite(url, { request: { headers: withTenantHeaders(request, remembered) } }), { noindex: true });
  }
  return finish(request, NextResponse.next({ request: { headers: withTenantHeaders(request, null) } }));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|downloads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
