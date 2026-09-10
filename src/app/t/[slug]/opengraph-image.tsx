import { ImageResponse } from "next/og";
import { studioBySlug, siteOf } from "@/lib/tenant-data";
import { contrastInk } from "@/lib/site/theme";

export const alt = "Studio website";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** OG image generated from the studio name and colors (plan 14.33). */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  const name = studio?.name ?? "Studio";
  const site = studio ? siteOf(studio) : null;
  const primary = site?.settings.colors.primary ?? "#111111";
  const ink = contrastInk(primary);
  const tagline = site?.settings.tagline ?? "";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 96, background: primary, color: ink, fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2 }}>{name}</div>
        {tagline ? <div style={{ marginTop: 16, fontSize: 34, opacity: 0.85 }}>{tagline}</div> : null}
      </div>
    ),
    size
  );
}
