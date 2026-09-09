import { z } from "zod";

/**
 * The template website (plan 3.66). Two templates share one content shape so a
 * studio can switch without losing text or images. Every section has
 * `enabled`; text fields are short and plain. No blocks, no HTML.
 */

export const TEMPLATES = ["editorial", "gallery"] as const;
export type TemplateId = (typeof TEMPLATES)[number];
export const FONT_PAIRINGS = ["classic", "modern", "warm"] as const;
export type FontPairing = (typeof FONT_PAIRINGS)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #1A2B3C.");
const short = (max: number) => z.string().trim().max(max).default("");
const button = z.object({ label: short(40), target: z.enum(["contact", "pricing", "portfolio", "book", "gallery", "about", "url"]).default("contact"), url: z.string().trim().max(300).optional() });
const image = z.string().uuid().nullable().default(null); // asset id

export const siteSettingsSchema = z.object({
  template: z.enum(TEMPLATES).default("editorial"),
  colors: z.object({ primary: hex.default("#111111"), accent: hex.default("#b45309"), base: z.enum(["light", "dark"]).default("light") }).default({ primary: "#111111", accent: "#b45309", base: "light" }),
  font: z.enum(FONT_PAIRINGS).default("classic"),
  logoAssetId: image,
  faviconAssetId: image,
  tagline: short(120),
  social: z.object({ instagram: short(200), linkedin: short(200), facebook: short(200), tiktok: short(200) }).default({ instagram: "", linkedin: "", facebook: "", tiktok: "" }),
  address: z.object({ street: short(120), locality: short(80), region: short(40), postalCode: short(20), country: short(2), mapUrl: short(300) }).default({ street: "", locality: "", region: "", postalCode: "", country: "", mapUrl: "" }),
  hours: short(400),
  footerText: short(300),
  gaMeasurementId: short(30),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

const section = <T extends z.ZodRawShape>(shape: T) => z.object({ enabled: z.boolean().default(true), ...shape });

export const homeSchema = z.object({
  hero: section({ heading: short(90), subheading: short(200), imageAssetId: image, button: button.default({ label: "Book a session", target: "contact" }), secondaryButton: button.default({ label: "See the portfolio", target: "portfolio" }) }),
  intro: section({ heading: short(90), body: short(1200), imageAssetId: image }),
  portfolioStrip: section({ heading: short(90), limit: z.number().int().min(3).max(12).default(6), featuredOnly: z.boolean().default(true) }),
  packages: section({ heading: short(90), body: short(300) }),
  testimonials: section({ heading: short(90), limit: z.number().int().min(1).max(12).default(6) }),
  faq: section({ heading: short(90), items: z.array(z.object({ q: short(160), a: short(800) })).max(12).default([]) }),
  location: section({ heading: short(90), body: short(400) }),
  cta: section({ heading: short(90), body: short(300), imageAssetId: image, button: button.default({ label: "Get in touch", target: "contact" }) }),
});

export const portfolioPageSchema = z.object({
  enabled: z.boolean().default(true),
  hero: section({ heading: short(90), subheading: short(200), imageAssetId: image }),
  grid: section({ showFilters: z.boolean().default(true), limit: z.number().int().min(6).max(120).default(60) }),
  cta: section({ heading: short(90), button: button.default({ label: "See pricing", target: "pricing" }) }),
});

export const pricingPageSchema = z.object({
  enabled: z.boolean().default(true),
  hero: section({ heading: short(90), subheading: short(200), imageAssetId: image }),
  packages: section({ body: short(300), buttonLabel: short(40) }),
  included: section({ heading: short(90), items: z.array(short(160)).max(12).default([]) }),
  faq: section({ heading: short(90), items: z.array(z.object({ q: short(160), a: short(800) })).max(12).default([]) }),
  cta: section({ heading: short(90), button: button.default({ label: "Book a session", target: "contact" }) }),
});

export const aboutPageSchema = z.object({
  enabled: z.boolean().default(true),
  hero: section({ heading: short(90), subheading: short(200), imageAssetId: image }),
  bio: section({ heading: short(90), body: short(4000), portraitAssetId: image }),
  steps: section({ heading: short(90), items: z.array(z.object({ title: short(80), text: short(400) })).max(6).default([]) }),
  cta: section({ heading: short(90), button: button.default({ label: "Get in touch", target: "contact" }) }),
});

export const contactPageSchema = z.object({
  enabled: z.boolean().default(true),
  hero: section({ heading: short(90), subheading: short(200), imageAssetId: image }),
  form: section({ showPackagePicker: z.boolean().default(true), showPhone: z.boolean().default(true), showPreferredDate: z.boolean().default(true), successMessage: short(300) }),
  details: section({ showAddress: z.boolean().default(true), showHours: z.boolean().default(true), showMap: z.boolean().default(true) }),
});

export const galleryPageSchema = z.object({ enabled: z.boolean().default(true), heading: short(90), body: short(300) });
export const bookPageSchema = z.object({ enabled: z.boolean().default(false), heading: short(90), body: short(300) });

export const areasSchema = z.object({
  enabled: z.boolean().default(false),
  headingPattern: short(90),
  bodyPattern: short(1200),
});

export const seoSchema = z.object({
  siteTitle: short(70),
  siteDescription: short(170),
  ogAssetId: image,
  pages: z.record(z.string(), z.object({ title: short(70), description: short(170) })).default({}),
});

export const siteSchema = z.object({
  version: z.literal(1).default(1),
  settings: siteSettingsSchema.default(siteSettingsSchema.parse({})),
  home: homeSchema,
  portfolio: portfolioPageSchema,
  pricing: pricingPageSchema,
  about: aboutPageSchema,
  contact: contactPageSchema,
  gallery: galleryPageSchema,
  book: bookPageSchema,
  areas: areasSchema,
  seo: seoSchema,
});
export type Site = z.infer<typeof siteSchema>;

export const SITE_PAGES = ["home", "portfolio", "pricing", "about", "book", "contact", "gallery"] as const;
export type SitePage = (typeof SITE_PAGES)[number];

/** Parses stored JSON; missing parts fall back to defaults so old rows keep working. */
export function parseSite(raw: unknown, fallback: Site): Site {
  const res = siteSchema.safeParse(raw);
  return res.success ? res.data : fallback;
}
