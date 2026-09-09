import type { FontPairing, SiteSettings } from "@/lib/site/schema";

/** CSS variables and contrast checks for the template site (plan 3.68). Pure. */

export const FONT_STACKS: Record<FontPairing, { heading: string; body: string; google: string[] }> = {
  classic: { heading: "'Playfair Display', Georgia, serif", body: "'Inter', system-ui, sans-serif", google: ["Playfair Display", "Inter"] },
  modern: { heading: "'Space Grotesk', system-ui, sans-serif", body: "'Inter', system-ui, sans-serif", google: ["Space Grotesk", "Inter"] },
  warm: { heading: "'Fraunces', Georgia, serif", body: "'Source Sans 3', system-ui, sans-serif", google: ["Fraunces", "Source Sans 3"] },
};

export function relativeLuminance(hex: string) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return 0;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Text color that reads on the given background. */
export function contrastInk(hex: string) {
  return relativeLuminance(hex) > 0.4 ? "#111111" : "#ffffff";
}

export type ThemeIssue = { field: "primary" | "accent"; message: string };

/**
 * Button text always gets an automatic black or white ink, so what can fail is
 * the button or accent blending into the page. WCAG 1.4.11 asks 3:1 for UI
 * components against their background (plan 4.16, 14.25).
 */
export function themeIssues(colors: SiteSettings["colors"]): ThemeIssue[] {
  const bg = colors.base === "dark" ? "#0b0b0c" : "#ffffff";
  const issues: ThemeIssue[] = [];
  if (contrastRatio(colors.primary, bg) < 3) issues.push({ field: "primary", message: `The primary color is too close to a ${colors.base} background. Pick a ${colors.base === "dark" ? "lighter" : "darker"} shade.` });
  if (contrastRatio(colors.accent, bg) < 3) issues.push({ field: "accent", message: `The accent color does not stand out on a ${colors.base} background.` });
  return issues;
}

/** CSS custom properties for the tenant layout. */
export function themeCss(settings: SiteSettings) {
  const dark = settings.colors.base === "dark";
  const fonts = FONT_STACKS[settings.font];
  const vars: Record<string, string> = {
    "--site-primary": settings.colors.primary,
    "--site-primary-ink": contrastInk(settings.colors.primary),
    "--site-accent": settings.colors.accent,
    "--site-bg": dark ? "#0b0b0c" : "#ffffff",
    "--site-bg-2": dark ? "#151517" : "#f6f5f3",
    "--site-ink": dark ? "#f4f4f5" : "#111111",
    "--site-ink-2": dark ? "#b3b3b8" : "#5b5b60",
    "--site-line": dark ? "#26262a" : "#e6e4e0",
    "--site-font-heading": fonts.heading,
    "--site-font-body": fonts.body,
  };
  return Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";");
}

export function googleFontsHref(font: FontPairing) {
  const families = FONT_STACKS[font].google.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
