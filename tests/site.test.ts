import { describe, expect, it } from "vitest";
import { defaultSite } from "@/lib/site/defaults";
import { parseSite, siteSchema } from "@/lib/site/schema";
import { buttonHref, navPages, validateForPublish } from "@/lib/site/publish";
import { contrastRatio, themeCss, themeIssues } from "@/lib/site/theme";
import { areaCopy, areaSlug, localBusinessJsonLd, pageMeta } from "@/lib/site/seo";

describe("site defaults and schema", () => {
  it("produces a valid site with the studio name filled in", () => {
    const site = defaultSite("Acme Headshots", "Brooklyn");
    expect(siteSchema.safeParse(site).success).toBe(true);
    expect(site.home.hero.subheading).toContain("Brooklyn");
    expect(site.seo.siteTitle).toBe("Acme Headshots | Headshot photographer in Brooklyn");
    expect(site.book.enabled).toBe(false);
  });
  it("falls back when stored JSON is invalid", () => {
    const fallback = defaultSite("X");
    expect(parseSite({ nonsense: true }, fallback)).toBe(fallback);
    expect(parseSite(fallback, defaultSite("Y")).seo.siteTitle).toContain("X");
  });
});

describe("publish validation", () => {
  it("passes the defaults and reports specific problems", () => {
    const site = defaultSite("Acme");
    expect(validateForPublish(site)).toMatchObject({ ok: true });
    const broken = { ...site, home: { ...site.home, hero: { ...site.home.hero, heading: "" } }, settings: { ...site.settings, colors: { primary: "#ffffff", accent: "#ffffff", base: "light" as const } } };
    const res = validateForPublish(broken);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.issues.map((i) => i.path)).toEqual(expect.arrayContaining(["home.hero.heading", "settings.colors.primary", "settings.colors.accent"]));
  });
  it("builds the nav in fixed order and resolves buttons", () => {
    const site = defaultSite("Acme");
    expect(navPages(site).map((n) => n.page)).toEqual(["portfolio", "pricing", "about", "contact", "gallery"]);
    expect(buttonHref({ target: "url", url: "https://x.com" })).toBe("https://x.com");
    expect(buttonHref({ target: "url", url: "javascript:alert(1)" })).toBe("/contact");
  });
});

describe("theme", () => {
  it("computes contrast and flags weak colors", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(themeIssues({ primary: "#111111", accent: "#b45309", base: "light" })).toEqual([]);
    expect(themeIssues({ primary: "#f0f0f0", accent: "#fafafa", base: "light" }).length).toBe(2);
    expect(themeCss(defaultSite("A").settings)).toContain("--site-primary:#111111");
  });
});

describe("seo", () => {
  it("builds page titles, structured data and area copy", () => {
    const site = defaultSite("Acme", "Brooklyn");
    expect(pageMeta(site, "pricing", "Acme").title).toBe("Pricing | Acme");
    expect(pageMeta(site, "home", "Acme").title).toContain("Acme");
    const ld = localBusinessJsonLd(site, { name: "Acme", email: "a@b.c", phone: null }, "https://acme.example", null);
    expect(ld["@type"]).toBe("ProfessionalService");
    expect(areaSlug("St. John's Wood")).toBe("st-johns-wood");
    expect(areaCopy(site, "Queens").heading).toBe("Headshots in Queens");
  });
});
