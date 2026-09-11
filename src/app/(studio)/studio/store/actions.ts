"use server";

import { revalidatePath } from "next/cache";
import { requireEntitledStudio } from "@/lib/auth";
import { db } from "@/lib/db";
import { archiveProduct, createDiscount, createProduct, replaceProductPrices, setDiscountActive, updateProduct, type ProductPriceInput } from "@/lib/store";
import { fieldErrors, storeDiscountSchema, storePriceRowSchema, storeProductSchema, storeSettingsSchema } from "@/lib/validation";
import { cents, int, str, type ActionState } from "@/lib/action-state";
import type { StoreProductKind } from "@/lib/types";

const KINDS: StoreProductKind[] = ["image", "bundle", "gallery_unlock", "collection_unlock", "gift_card", "voucher", "digital", "print"];

/** Parse the dialog's `prices` JSON (rows of {resolution, license, amount in dollars}). */
function parsePrices(raw: string): ProductPriceInput[] | null {
  let arr: unknown;
  try {
    arr = JSON.parse(raw || "[]");
  } catch {
    return null;
  }
  if (!Array.isArray(arr)) return null;
  const out: ProductPriceInput[] = [];
  for (const row of arr) {
    const r = row as { resolution?: unknown; license?: unknown; amount?: unknown };
    const amountCents = Math.round(Number(r.amount) * 100);
    const parsed = storePriceRowSchema.safeParse({ resolution: r.resolution, license: r.license, amountCents });
    if (!parsed.success) return null;
    out.push(parsed.data);
  }
  return out;
}

export async function saveProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireEntitledStudio("store", "admin");
  const parsed = storeProductSchema.safeParse({
    title: str(formData, "title", 120),
    description: str(formData, "description", 2000),
    licenseText: str(formData, "licenseText", 4000),
    isActive: formData.get("active") === "on",
    isFeatured: formData.get("featured") === "on",
  });
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const prices = parsePrices(str(formData, "prices", 8000));
  if (!prices) return { error: "One of the price options is invalid.", fields: { prices: "Check the resolution, licence and amount." } };
  const kindRaw = str(formData, "kind", 40);
  const kind: StoreProductKind = (KINDS as string[]).includes(kindRaw) ? (kindRaw as StoreProductKind) : "image";
  const id = str(formData, "id", 64);
  const input = {
    kind,
    title: parsed.data.title,
    description: parsed.data.description || null,
    licenseText: parsed.data.licenseText || null,
    isActive: parsed.data.isActive ?? true,
    isFeatured: parsed.data.isFeatured ?? false,
    photoId: str(formData, "photoId", 64) || null,
    assetId: str(formData, "assetId", 64) || null,
    galleryId: str(formData, "galleryId", 64) || null,
  };
  const product = id ? await updateProduct(studio.id, id, input) : await createProduct(studio.id, input);
  if (product) await replaceProductPrices(studio.id, product.id, prices);
  revalidatePath("/studio/store");
  return { ok: true, message: id ? "Product saved." : "Product added." };
}

export async function archiveProductAction(formData: FormData) {
  const { studio } = await requireEntitledStudio("store", "admin");
  const id = str(formData, "id", 64);
  if (str(formData, "active", 5) === "true") await updateProduct(studio.id, id, { isActive: true });
  else await archiveProduct(studio.id, id);
  revalidatePath("/studio/store");
}

export async function saveStoreSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireEntitledStudio("store", "admin");
  const parsed = storeSettingsSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    paymentMode: str(formData, "paymentMode", 20),
    taxMode: str(formData, "taxMode", 20),
    commissionBps: Math.round(Number(str(formData, "commissionPercent", 10)) * 100) || 0,
    watermark: formData.get("watermark") === "on",
    watermarkText: str(formData, "watermarkText", 60),
    downloadMaxCount: str(formData, "downloadMaxCount", 10),
    downloadWindowHours: str(formData, "downloadWindowHours", 10),
    deliveryPolicy: str(formData, "deliveryPolicy", 4000),
    manualInstructions: str(formData, "manualInstructions", 4000),
    manualPaymentLink: str(formData, "manualPaymentLink", 500),
  });
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const store = {
    enabled: parsed.data.enabled ?? false,
    paymentMode: parsed.data.paymentMode,
    taxMode: parsed.data.taxMode,
    commissionBps: parsed.data.commissionBps,
    watermark: parsed.data.watermark ?? true,
    watermarkText: parsed.data.watermarkText || null,
    downloadMaxCount: parsed.data.downloadMaxCount,
    downloadWindowHours: parsed.data.downloadWindowHours,
    deliveryPolicy: parsed.data.deliveryPolicy || null,
    manualInstructions: parsed.data.manualInstructions || null,
    manualPaymentLink: parsed.data.manualPaymentLink || null,
  };
  await db()`update studios set settings = settings || ${JSON.stringify({ store })}::jsonb, updated_at = now() where id = ${studio.id}`;
  revalidatePath("/studio/store/settings");
  return { ok: true, message: "Store settings saved." };
}

export async function saveDiscountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireEntitledStudio("store", "admin");
  const kind = str(formData, "kind", 20);
  const amount = Number(str(formData, "amount", 20).replace(/[^0-9.]/g, "")) || 0;
  const value = kind === "percent" ? Math.round(amount) : kind === "fixed" ? Math.round(amount * 100) : 0;
  const parsed = storeDiscountSchema.safeParse({
    code: str(formData, "code", 40),
    kind,
    value,
    minSubtotalCents: cents(formData, "minSubtotal") || undefined,
    maxUses: int(formData, "maxUses") || undefined,
  });
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  if (parsed.data.kind === "percent" && parsed.data.value > 100) return { error: "A percentage cannot be more than 100.", fields: { amount: "Between 0 and 100." } };
  await createDiscount(studio.id, {
    code: parsed.data.code,
    kind: parsed.data.kind,
    value: parsed.data.value,
    minSubtotalCents: parsed.data.minSubtotalCents ?? null,
    maxUses: parsed.data.maxUses ?? null,
  });
  revalidatePath("/studio/store/discounts");
  return { ok: true, message: "Code saved." };
}

export async function toggleDiscountAction(formData: FormData) {
  const { studio } = await requireEntitledStudio("store", "admin");
  const id = str(formData, "id", 64);
  await setDiscountActive(studio.id, id, str(formData, "active", 5) === "true");
  revalidatePath("/studio/store/discounts");
}
