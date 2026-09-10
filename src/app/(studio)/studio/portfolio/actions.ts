"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { requireStudio } from "@/lib/auth";
import { addAssetsToPortfolio, updatePortfolioItem, removePortfolioItem, reorderPortfolio, renamePortfolioCategory, importableGalleries, galleryPhotosForImport, importPhotosToPortfolio } from "@/lib/portfolio";

export async function addToPortfolioAction(assetIds: string[], category: string) {
  const { studio } = await requireWritableStudio();
  const clean = assetIds.filter((s) => typeof s === "string").slice(0, 200);
  if (clean.length) await addAssetsToPortfolio(studio.id, clean, category);
  revalidatePath("/studio/portfolio");
}

export async function updatePortfolioItemAction(id: string, patch: { caption?: string | null; category?: string; is_featured?: boolean; is_published?: boolean }) {
  const { studio } = await requireWritableStudio();
  await updatePortfolioItem(studio.id, id, patch);
  revalidatePath("/studio/portfolio");
}

export async function removePortfolioItemAction(id: string) {
  const { studio } = await requireWritableStudio();
  await removePortfolioItem(studio.id, id);
  revalidatePath("/studio/portfolio");
}

export async function reorderPortfolioAction(orderedIds: string[]) {
  const { studio } = await requireWritableStudio();
  await reorderPortfolio(studio.id, orderedIds);
  revalidatePath("/studio/portfolio");
}

export async function renameCategoryAction(from: string, to: string) {
  const { studio } = await requireWritableStudio();
  await renamePortfolioCategory(studio.id, from, to);
  revalidatePath("/studio/portfolio");
}

/** Galleries whose client agreed to portfolio use (plan 15.6). */
export async function listImportGalleriesAction() {
  const { studio } = await requireStudio();
  return importableGalleries(studio.id);
}

export async function listGalleryPhotosAction(galleryId: string) {
  const { studio } = await requireStudio();
  return galleryPhotosForImport(studio.id, galleryId);
}

export async function importPhotosAction(photoIds: string[], category: string) {
  const { studio } = await requireWritableStudio();
  const clean = photoIds.filter((s) => typeof s === "string").slice(0, 200);
  const added = clean.length ? await importPhotosToPortfolio(studio.id, clean, category) : 0;
  revalidatePath("/studio/portfolio");
  return added;
}
