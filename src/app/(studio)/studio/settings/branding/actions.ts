"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { db } from "@/lib/db";
import { assetById } from "@/lib/assets";
import type { ActionState } from "@/lib/action-state";

/** Logo, favicon and brand color, used by app emails and tenant pages (plan 17.3). */
export async function saveBrandingAction(input: { logoAssetId: string | null; faviconAssetId: string | null; brandColor: string }): Promise<ActionState> {
  const { studio } = await requireWritableStudio("admin");
  if (!/^#[0-9a-fA-F]{6}$/.test(input.brandColor)) return { error: "Use a hex color like #1A2B3C." };

  const logo = input.logoAssetId ? await assetById(studio.id, input.logoAssetId) : null;
  const favicon = input.faviconAssetId ? await assetById(studio.id, input.faviconAssetId) : null;
  const logoUrl = logo ? logo.web_url ?? logo.url : null;
  const faviconUrl = favicon ? favicon.thumb_url ?? favicon.url : null;

  const settingsPatch = {
    logo_asset_id: input.logoAssetId,
    favicon_asset_id: input.faviconAssetId,
    favicon_url: faviconUrl,
  };
  await db()`
    update studios set logo_url = ${logoUrl}, brand_color = ${input.brandColor.toLowerCase()},
      settings = settings || ${JSON.stringify(settingsPatch)}::jsonb, updated_at = now()
    where id = ${studio.id}`;
  revalidatePath("/studio/settings/branding");
  return { ok: true, message: "Branding saved." };
}
