"use server";

import { headers } from "next/headers";
import { isUuid } from "@/lib/db";
import { studioBySlug } from "@/lib/tenant-data";
import { billingState, entitlements } from "@/lib/plans";
import { storeSettings } from "@/lib/store-shared";
import { ensureBuyerKey } from "@/lib/store-buyer";
import { setFavoriteEmail, toggleFavorite } from "@/lib/store";
import { clientIp, limited } from "@/lib/rate-limit";
import type { ActionState } from "@/lib/action-state";

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

/** Opt in to favourite reminders: attach an email to this buyer's favourites. */
export async function saveFavoriteEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const studio = await studioBySlug(slug);
  if (!studio) return { error: "Something went wrong." };
  const settings = storeSettings((studio.settings ?? {}) as Record<string, unknown>);
  if (!settings.enabled || !entitlements(billingState(studio).effectivePlan).store) return { error: "Not available." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address.", fields: { email: "Enter a valid email address." } };
  const rl = await limited("store_favorite", `${studio.id}:${clientIp(await headers())}`);
  if (!rl.ok) return { error: "Too many attempts. Try again in a few minutes." };
  const key = await ensureBuyerKey();
  await setFavoriteEmail(studio.id, key, email);
  return { ok: true, message: "You're set — we'll email you a reminder about these." };
}
