import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { listAssets, isReady } from "@/lib/assets";
import { Card } from "@/components/ui";
import type { PickerAsset } from "../../website/image-picker";
import { BrandingForm } from "./branding-form";

export const metadata: Metadata = { title: "Branding" };

/** Logo, favicon and brand color (plan 17.3). */
export default async function BrandingSettingsPage() {
  const ctx = await requireStudioPage("admin");
  const settings = (ctx.studio.settings ?? {}) as Record<string, unknown>;
  const assets: PickerAsset[] = (await listAssets(ctx.studio.id))
    .filter(isReady)
    .map((a) => ({ id: a.id, thumb: a.thumb_url ?? a.web_url ?? a.url, filename: a.filename, alt: a.alt }));

  return (
    <Card>
      <h2 className="font-medium mb-1">Branding</h2>
      <p className="text-sm text-ink-2 mb-4">Your logo and color appear on your website, client galleries and the emails your studio sends.</p>
      <BrandingForm
        assets={assets}
        logoAssetId={typeof settings.logo_asset_id === "string" ? settings.logo_asset_id : null}
        faviconAssetId={typeof settings.favicon_asset_id === "string" ? settings.favicon_asset_id : null}
        brandColor={ctx.studio.brand_color || "#111111"}
      />
    </Card>
  );
}
