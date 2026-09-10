"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { beginAssetUpload, completeAssetUpload, updateAsset, deleteAsset, bulkUpdateFolder, bulkDeleteAssets, assetUses, type AssetUploadMeta } from "@/lib/assets";
import { audit } from "@/lib/audit";
import { str } from "@/lib/action-state";

/** Uploader.begin: reserve an asset row and a public direct-upload token (plan 15.1.1). */
export async function beginAssetUploadAction(meta: AssetUploadMeta, folder?: string) {
  const { studio, user } = await requireWritableStudio();
  const ticket = await beginAssetUpload(studio.id, user.id, meta, folder);
  return { id: ticket.assetId, pathname: ticket.pathname, token: ticket.token };
}

/** Uploader.complete: generate variants once the bytes have landed (plan 15.4). */
export async function completeAssetUploadAction(assetId: string, url: string) {
  const { studio } = await requireWritableStudio();
  await completeAssetUpload(studio.id, assetId, url);
  revalidatePath("/studio/assets");
}

/** Alt text, tags and folder from the detail drawer (plan 15.2). */
export async function updateAssetAction(formData: FormData) {
  const { studio } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const alt = str(formData, "alt", 300);
  const tags = str(formData, "tags", 400).split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 20);
  const folderRaw = str(formData, "folder", 40);
  await updateAsset(studio.id, id, { alt, tags, folder: folderRaw || null });
  revalidatePath("/studio/assets");
}

/** Delete one asset unless it is in use (plan 15.2). Returns the blocking uses, if any. */
export async function deleteAssetAction(formData: FormData): Promise<{ ok: boolean; uses?: string[] }> {
  const { studio, user } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const res = await deleteAsset(studio.id, id);
  if (res.deleted) await audit({ studioId: studio.id, actorUserId: user.id, action: "asset.deleted", targetId: id });
  revalidatePath("/studio/assets");
  return res.deleted ? { ok: true } : { ok: false, uses: res.uses };
}

/** Where an asset is used, for the detail drawer (plan 15.2). */
export async function assetUsesAction(id: string): Promise<string[]> {
  const { studio } = await requireWritableStudio();
  return assetUses(studio.id, id);
}

/** Bulk move to a folder or delete (plan 15.3). */
export async function bulkAssetsAction(formData: FormData) {
  const { studio } = await requireWritableStudio();
  const ids = str(formData, "ids", 20000).split(",").map((s) => s.trim()).filter(Boolean);
  const op = str(formData, "op", 20);
  if (!ids.length) return;
  if (op === "delete") await bulkDeleteAssets(studio.id, ids);
  else if (op === "folder") await bulkUpdateFolder(studio.id, ids, str(formData, "folder", 40) || null);
  revalidatePath("/studio/assets");
}
