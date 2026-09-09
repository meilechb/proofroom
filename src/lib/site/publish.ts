import { siteSchema, type Site } from "@/lib/site/schema";
import { themeIssues } from "@/lib/site/theme";

/** Validation before a draft goes live (plan 3.69, 14.25). Pure; the DB write lives in the server action. */

export type PublishIssue = { path: string; message: string };

export function validateForPublish(raw: unknown): { ok: true; site: Site } | { ok: false; issues: PublishIssue[] } {
  const parsed = siteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
  const site = parsed.data;
  const issues: PublishIssue[] = [];
  if (site.home.hero.enabled && !site.home.hero.heading.trim()) issues.push({ path: "home.hero.heading", message: "The home page needs a headline." });
  const enabledPages = [site.portfolio.enabled, site.pricing.enabled, site.about.enabled, site.contact.enabled, site.gallery.enabled, site.book.enabled].filter(Boolean).length;
  if (enabledPages === 0) issues.push({ path: "pages", message: "Enable at least one page besides Home." });
  for (const issue of themeIssues(site.settings.colors)) issues.push({ path: `settings.colors.${issue.field}`, message: issue.message });
  if (!site.seo.siteTitle.trim()) issues.push({ path: "seo.siteTitle", message: "Add a site title for search results." });
  return issues.length ? { ok: false, issues } : { ok: true, site };
}

/** Which pages appear in the header, in fixed order (plan 14.12). */
export function navPages(site: Site): { page: string; label: string; path: string }[] {
  const items: { page: string; label: string; path: string; on: boolean }[] = [
    { page: "portfolio", label: "Portfolio", path: "/portfolio", on: site.portfolio.enabled },
    { page: "pricing", label: "Pricing", path: "/pricing", on: site.pricing.enabled },
    { page: "about", label: "About", path: "/about", on: site.about.enabled },
    { page: "book", label: "Book", path: "/book", on: site.book.enabled },
    { page: "contact", label: "Contact", path: "/contact", on: site.contact.enabled },
    { page: "gallery", label: "Your gallery", path: "/g", on: site.gallery.enabled },
  ];
  return items.filter((i) => i.on).map(({ page, label, path }) => ({ page, label, path }));
}

export function buttonHref(button: { target: string; url?: string }, fallback = "/contact") {
  switch (button.target) {
    case "contact": return "/contact";
    case "pricing": return "/pricing";
    case "portfolio": return "/portfolio";
    case "book": return "/book";
    case "gallery": return "/g";
    case "about": return "/about";
    case "url": return button.url && /^https?:\/\//i.test(button.url) ? button.url : fallback;
    default: return fallback;
  }
}
