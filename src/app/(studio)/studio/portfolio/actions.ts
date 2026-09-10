"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { addAssetsToPortfolio, updatePortfolioItem, removePortfolioItem, reorderPortfolio, renamePortfolioCategory } from "@/lib/portfolio";

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
