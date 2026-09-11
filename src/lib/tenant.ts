import { appDomain, appUrl } from "@/lib/env";
import type { Studio } from "@/lib/types";

/**
 * Tenant resolution. A studio is reachable three ways, all rewritten to
 * /t/{slug}/... by the proxy:
 *   1. {slug}.APP_DOMAIN            (wildcard subdomain)
 *   2. a verified custom domain     (looked up in the database by the proxy)
 *   3. APP_DOMAIN/t/{slug}/...      (always works, used on previews and locally)
 */

export type HostKind =
  | { kind: "root" }
  | { kind: "subdomain"; slug: string }
  | { kind: "custom"; host: string };

export function classifyHost(hostHeader: string | null, rootDomain = appDomain()): HostKind {
  const host = (hostHeader ?? "").toLowerCase().split(":")[0];
  const root = rootDomain.toLowerCase().split(":")[0];
  if (!host || host === root || host === `www.${root}` || host === "localhost" || host === "127.0.0.1") return { kind: "root" };
  if (host.endsWith(`.${root}`)) {
    const slug = host.slice(0, -(root.length + 1));
    if (slug === "www" || slug.includes(".")) return { kind: "root" };
    return { kind: "subdomain", slug };
  }
  // Vercel preview / deployment URLs behave like the root host.
  if (host.endsWith(".vercel.app")) return { kind: "root" };
  return { kind: "custom", host };
}

/** Public base URL for a studio's client-facing pages. */
export function studioBaseUrl(studio: Pick<Studio, "slug" | "custom_domain" | "custom_domain_verified_at">) {
  if (studio.custom_domain && studio.custom_domain_verified_at) return `https://${studio.custom_domain}`;
  const domain = appDomain();
  if (domain.startsWith("localhost")) return `${appUrl()}/t/${studio.slug}`;
  return `https://${studio.slug}.${domain}`;
}

export function galleryUrl(studio: Pick<Studio, "slug" | "custom_domain" | "custom_domain_verified_at">, slug: string) {
  return `${studioBaseUrl(studio)}/g/${slug}`;
}

export function payUrl(studio: Pick<Studio, "slug" | "custom_domain" | "custom_domain_verified_at">, orderId: string) {
  return `${studioBaseUrl(studio)}/pay/${orderId}`;
}

/** Path prefix for tenant pages when rendering links inside the tenant tree. */
export function tenantPath(slug: string, path = "") {
  return `/t/${slug}${path}`;
}

type StudioHost = Pick<Studio, "slug" | "custom_domain" | "custom_domain_verified_at">;

export function bookingUrl(studio: StudioHost) {
  return `${studioBaseUrl(studio)}/book`;
}

/** Public storefront and a single product page. */
export function shopUrl(studio: StudioHost) {
  return `${studioBaseUrl(studio)}/shop`;
}
export function productUrl(studio: StudioHost, productSlug: string) {
  return `${studioBaseUrl(studio)}/shop/${productSlug}`;
}

/** Buyer download library, entered through an emailed token (no login). */
export function storeLibraryUrl(studio: StudioHost, token: string) {
  return `${studioBaseUrl(studio)}/library/${token}`;
}

/** Printable licence / print-release for a purchase. */
export function storeLicenseUrl(studio: StudioHost, token: string) {
  return `${studioBaseUrl(studio)}/license/${token}`;
}

/** Client hub entered through an emailed magic link token. */
export function clientHubUrl(studio: StudioHost, token: string) {
  return `${studioBaseUrl(studio)}/my/${token}`;
}

/** Local area landing page, e.g. /headshots/brooklyn. */
export function areaUrl(studio: StudioHost, areaSlug: string) {
  return `${studioBaseUrl(studio)}/headshots/${areaSlug}`;
}

export function unsubscribeUrl(studio: StudioHost, token: string) {
  return `${studioBaseUrl(studio)}/u/${token}`;
}
