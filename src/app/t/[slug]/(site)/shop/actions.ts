"use server";

import { headers } from "next/headers";
import { isUuid } from "@/lib/db";
import { studioBySlug } from "@/lib/tenant-data";
import { billingState, entitlements } from "@/lib/plans";
import { storeSettings } from "@/lib/store-shared";
import { ensureBuyerKey } from "@/lib/store-buyer";
import { toggleFavorite } from "@/lib/store";
import { clientIp, limited } from "@/lib/rate-limit";

/**
 * Toggle a storefront favourite for the anonymous buyer (cookie key). A plain
 * FormData action so the heart works without JavaScript; Next re-renders the
 * dynamic shop page with the new state after it runs.
 */
export async function toggleFavoriteAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!slug || !isUuid(productId)) return;
  const studio = await studioBySlug(slug);
  if (!studio) return;
  const settings = storeSettings((studio.settings ?? {}) as Record<string, unknown>);
  if (!settings.enabled || !entitlements(billingState(studio).effectivePlan).store) return;
  const rl = await limited("store_favorite", `${studio.id}:${clientIp(await headers())}`);
  if (!rl.ok) return;
  const key = await ensureBuyerKey();
  await toggleFavorite(studio.id, key, productId);
}
