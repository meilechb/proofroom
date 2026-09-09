import { z } from "zod";

/**
 * Tenant website content model. A page is an ordered list of typed blocks.
 * Block types are fixed and rendered by components in src/components/site.
 * This file is dependency-free apart from zod so both the editor (client) and
 * renderer (server) share it.
 */

export const blockSchemas = {
  hero: z.object({
    type: z.literal("hero"),
    eyebrow: z.string().max(80).optional(),
    heading: z.string().max(160),
    text: z.string().max(600).optional(),
    imageAssetId: z.string().optional(),
    primaryCta: z.object({ label: z.string().max(40), href: z.string().max(200) }).optional(),
    secondaryCta: z.object({ label: z.string().max(40), href: z.string().max(200) }).optional(),
    layout: z.enum(["image-right", "image-background", "text-only"]).default("image-right"),
  }),
  text: z.object({ type: z.literal("text"), heading: z.string().max(160).optional(), body: z.string().max(8000) }),
  imageText: z.object({
    type: z.literal("imageText"),
    heading: z.string().max(160).optional(),
    body: z.string().max(4000),
    imageAssetId: z.string().optional(),
    imageSide: z.enum(["left", "right"]).default("left"),
  }),
  portfolio: z.object({
    type: z.literal("portfolio"),
    heading: z.string().max(160).optional(),
    category: z.string().max(60).optional(),
    limit: z.number().int().min(1).max(60).default(12),
    featuredOnly: z.boolean().default(false),
    showFilters: z.boolean().default(false),
  }),
  packages: z.object({ type: z.literal("packages"), heading: z.string().max(160).optional(), text: z.string().max(600).optional(), ctaLabel: z.string().max(40).default("Book") }),
  testimonials: z.object({ type: z.literal("testimonials"), heading: z.string().max(160).optional(), limit: z.number().int().min(1).max(12).default(6) }),
  faq: z.object({
    type: z.literal("faq"),
    heading: z.string().max(160).optional(),
    items: z.array(z.object({ q: z.string().max(200), a: z.string().max(2000) })).max(30),
  }),
  contact: z.object({
    type: z.literal("contact"),
    heading: z.string().max(160).optional(),
    text: z.string().max(600).optional(),
    showPackagePicker: z.boolean().default(true),
    showPhone: z.boolean().default(true),
    successMessage: z.string().max(300).default("Thanks. I'll be in touch within one business day."),
  }),
  cta: z.object({ type: z.literal("cta"), heading: z.string().max(160), text: z.string().max(400).optional(), label: z.string().max(40), href: z.string().max(200) }),
  stats: z.object({ type: z.literal("stats"), items: z.array(z.object({ label: z.string().max(60), value: z.string().max(40) })).max(6) }),
  steps: z.object({
    type: z.literal("steps"),
    heading: z.string().max(160).optional(),
    items: z.array(z.object({ title: z.string().max(80), text: z.string().max(400) })).max(6),
  }),
  location: z.object({ type: z.literal("location"), heading: z.string().max(160).optional(), text: z.string().max(1000).optional(), showAddress: z.boolean().default(true), showHours: z.boolean().default(true) }),
  galleryLogin: z.object({ type: z.literal("galleryLogin"), heading: z.string().max(160).default("Open your gallery"), text: z.string().max(400).optional() }),
  html: z.object({ type: z.literal("html"), html: z.string().max(20000) }),
  spacer: z.object({ type: z.literal("spacer"), size: z.enum(["sm", "md", "lg"]).default("md") }),
} as const;

export type BlockType = keyof typeof blockSchemas;
export const blockSchema = z.discriminatedUnion("type", [
  blockSchemas.hero, blockSchemas.text, blockSchemas.imageText, blockSchemas.portfolio, blockSchemas.packages,
  blockSchemas.testimonials, blockSchemas.faq, blockSchemas.contact, blockSchemas.cta, blockSchemas.stats,
  blockSchemas.steps, blockSchemas.location, blockSchemas.galleryLogin, blockSchemas.html, blockSchemas.spacer,
]);
export type Block = z.infer<typeof blockSchema>;
export const blocksSchema = z.array(blockSchema).max(40);

export const blockLabels: Record<BlockType, string> = {
  hero: "Hero",
  text: "Text",
  imageText: "Image and text",
  portfolio: "Portfolio grid",
  packages: "Packages and prices",
  testimonials: "Reviews",
  faq: "Questions and answers",
  contact: "Contact form",
  cta: "Call to action",
  stats: "Quick facts",
  steps: "How it works",
  location: "Location and hours",
  galleryLogin: "Open your gallery",
  html: "Custom HTML",
  spacer: "Spacer",
};

export const seoSchema = z.object({
  title: z.string().max(70).optional(),
  description: z.string().max(170).optional(),
  ogAssetId: z.string().optional(),
  noindex: z.boolean().optional(),
});
export type Seo = z.infer<typeof seoSchema>;

export const themeSchema = z.object({
  mode: z.enum(["light", "dark"]).default("light"),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#111111"),
  font: z.enum(["inter", "serif", "grotesk"]).default("inter"),
  radius: z.enum(["sharp", "soft", "round"]).default("soft"),
  buttonStyle: z.enum(["solid", "outline"]).default("solid"),
});
export type Theme = z.infer<typeof themeSchema>;

export const siteSettingsSchema = z.object({
  theme: themeSchema.default({ mode: "light", primary: "#111111", font: "inter", radius: "soft", buttonStyle: "solid" }),
  tagline: z.string().max(160).optional(),
  description: z.string().max(300).optional(),
  address: z.object({ street: z.string().max(120).optional(), locality: z.string().max(80).optional(), region: z.string().max(40).optional(), postalCode: z.string().max(20).optional(), country: z.string().max(2).optional() }).optional(),
  hours: z.string().max(400).optional(),
  social: z.object({ instagram: z.string().max(200).optional(), linkedin: z.string().max(200).optional(), facebook: z.string().max(200).optional(), tiktok: z.string().max(200).optional() }).optional(),
  gaMeasurementId: z.string().max(30).optional(),
  footerText: z.string().max(300).optional(),
  showPoweredBy: z.boolean().default(true),
  serviceAreas: z.array(z.object({ slug: z.string().max(60), name: z.string().max(80), blurb: z.string().max(600).optional() })).max(40).default([]),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export function parseSiteSettings(raw: unknown): SiteSettings {
  const res = siteSettingsSchema.safeParse(raw ?? {});
  return res.success ? res.data : siteSettingsSchema.parse({});
}

/** Text color that reads on the given hex background. */
export function contrastInk(hex: string) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "#ffffff";
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#111111" : "#ffffff";
}

/** Starter pages for a new studio: the same set the reference headshot site has. */
export function defaultPages(studioName: string, location = "your area") {
  const pages: Array<{ slug: string; title: string; kind: string; nav_label: string | null; nav_order: number | null; in_footer: boolean; blocks: Block[]; seo: Seo }> = [
    {
      slug: "home",
      title: "Home",
      kind: "home",
      nav_label: null,
      nav_order: 0,
      in_footer: false,
      seo: { title: `${studioName} | Headshot photographer in ${location}`, description: `Professional headshots by ${studioName}. Business, LinkedIn, team and actor headshots in the studio or at your office.` },
      blocks: [
        { type: "hero", heading: "Stand out from the crowd", text: `Professional headshots in ${location}.`, layout: "image-background", primaryCta: { label: "Get in touch", href: "/contact" }, secondaryCta: { label: "Portfolio", href: "/portfolio" } },
        { type: "portfolio", heading: "Recent work", limit: 6, featuredOnly: true, showFilters: false },
        { type: "steps", heading: "How it works", items: [
          { title: "Book", text: "Send the form with a few dates that work. I confirm within one business day." },
          { title: "Shoot", text: "A relaxed session in the studio or at your office. Coaching on posing and expression included." },
          { title: "Choose and receive", text: "Proofs are posted to a private gallery. Mark your favorites and the retouched files follow within days." },
        ] },
        { type: "packages", heading: "Pricing", ctaLabel: "Book" },
        { type: "testimonials", heading: "What clients say", limit: 6 },
        { type: "contact", heading: "Contact", showPackagePicker: true, showPhone: true, successMessage: "Thanks. I'll be in touch within one business day." },
      ],
    },
    {
      slug: "portfolio",
      title: "Portfolio",
      kind: "portfolio",
      nav_label: "Portfolio",
      nav_order: 1,
      in_footer: true,
      seo: { title: `Headshot portfolio | ${studioName}` },
      blocks: [{ type: "portfolio", heading: "Portfolio", limit: 60, featuredOnly: false, showFilters: true }, { type: "cta", heading: "Want to stand out?", label: "See pricing", href: "/pricing" }],
    },
    {
      slug: "pricing",
      title: "Pricing",
      kind: "pricing",
      nav_label: "Pricing",
      nav_order: 2,
      in_footer: true,
      seo: { title: `Headshot pricing | ${studioName}` },
      blocks: [
        { type: "packages", heading: "Pricing", text: "Every session includes a private online proof gallery and retouched files sized for web and print.", ctaLabel: "Book" },
        { type: "faq", heading: "Questions", items: [
          { q: "How do I pay?", a: "A deposit reserves your date. The balance is due when your final images are delivered, paid securely online." },
          { q: "What should I wear?", a: "Solid colors and simple necklines photograph best. Bring two options if you can." },
          { q: "How are the photos delivered?", a: "Through a private online gallery where you can download web and print sizes." },
          { q: "Do you photograph teams?", a: "Yes. On-site sessions keep the background and lighting consistent for the whole staff page." },
        ] },
      ],
    },
    {
      slug: "about",
      title: "About",
      kind: "about",
      nav_label: "About",
      nav_order: 3,
      in_footer: true,
      seo: { title: `About | ${studioName}` },
      blocks: [{ type: "imageText", heading: `About ${studioName}`, body: "Write a few paragraphs about who you are, how you work, and what clients can expect on the day.", imageSide: "left" }, { type: "cta", heading: "Ready to book?", label: "Get in touch", href: "/contact" }],
    },
    {
      slug: "contact",
      title: "Contact",
      kind: "contact",
      nav_label: "Contact",
      nav_order: 4,
      in_footer: true,
      seo: { title: `Contact | ${studioName}` },
      blocks: [{ type: "contact", heading: "Contact", text: "Tell me what the photos are for and a few dates that work.", showPackagePicker: true, showPhone: true, successMessage: "Thanks. I'll be in touch within one business day." }, { type: "location", heading: "Studio", showAddress: true, showHours: true }],
    },
    {
      slug: "gallery",
      title: "Open your gallery",
      kind: "gallery_login",
      nav_label: null,
      nav_order: null,
      in_footer: true,
      seo: { title: `Open your gallery | ${studioName}`, noindex: true },
      blocks: [{ type: "galleryLogin", heading: "Open your gallery", text: "Enter the gallery link or the code from your email." }],
    },
  ];
  return pages;
}
