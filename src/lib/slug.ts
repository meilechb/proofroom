/** Subdomain and gallery slug rules shared by the client and server. */

export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "studio", "login", "signup", "help", "support", "docs", "blog", "mail",
  "static", "assets", "cdn", "status", "billing", "stripe", "pay", "t", "g", "dev", "staging", "test",
  "proofroom", "root", "system", "internal", "security", "legal", "terms", "privacy", "about", "pricing",
]);

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

export function normalizeSlug(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Returns a message when a studio subdomain is not allowed, else null. */
export function studioSlugProblem(slug: string): string | null {
  if (slug.length < 3) return "Use at least 3 characters.";
  if (!SLUG_RE.test(slug)) return "Only lowercase letters, numbers and hyphens, starting and ending with a letter or number.";
  if (RESERVED_SLUGS.has(slug)) return "That address is reserved.";
  if (slug.includes("--")) return "Avoid double hyphens.";
  return null;
}

/** Gallery slug from a title plus a short random suffix so links are unguessable. */
export function gallerySlug(title: string, suffix: string) {
  const base = normalizeSlug(title).slice(0, 48) || "gallery";
  return `${base}-${suffix}`;
}
