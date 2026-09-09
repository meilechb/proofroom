import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";
import { FEATURE_PAGES } from "@/components/marketing/features-content";
import { COMPARE_PAGES } from "@/components/marketing/compare-content";
import { LEGAL_DOCS } from "@/components/marketing/legal-content";

/** Marketing pages only. Studio, admin and tenant routes are never listed (plan 8.18). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const now = new Date();
  const entry = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "monthly") => ({ url: `${base}${path}`, lastModified: now, changeFrequency, priority });
  return [
    entry("/", 1, "weekly"),
    entry("/pricing", 0.9, "weekly"),
    entry("/lightroom", 0.8),
    entry("/security", 0.5),
    entry("/contact", 0.5, "yearly"),
    entry("/changelog", 0.4, "weekly"),
    ...FEATURE_PAGES.map((f) => entry(`/features/${f.slug}`, 0.8)),
    ...COMPARE_PAGES.map((c) => entry(`/compare/${c.slug}`, 0.7)),
    ...LEGAL_DOCS.map((d) => entry(`/${d.slug}`, 0.3, "yearly")),
  ];
}
