"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { archivePackage, createPackage, reorderPackages, updatePackage } from "@/lib/packages";
import { packageSchema, fieldErrors } from "@/lib/validation";
import { cents, int, str, type ActionState } from "@/lib/action-state";

function readPackage(formData: FormData) {
  return packageSchema.safeParse({
    name: str(formData, "name", 80),
    description: str(formData, "description", 2000),
    priceCents: cents(formData, "price"),
    depositCents: cents(formData, "deposit"),
    includedFinals: int(formData, "included"),
    extraFinalCents: cents(formData, "extra"),
    turnaround: str(formData, "turnaround", 120),
    isActive: formData.get("active") === "on",
    isFeatured: formData.get("featured") === "on",
  });
}

export async function savePackageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio("admin");
  const parsed = readPackage(formData);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  if (parsed.data.depositCents > parsed.data.priceCents) return { error: "The deposit cannot be more than the price.", fields: { deposit: "Not more than the price." } };
  const id = str(formData, "id", 64);
  const input = { ...parsed.data, description: parsed.data.description || null, turnaround: parsed.data.turnaround || null, includes: str(formData, "includes", 1000).split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 20) };
  if (id) await updatePackage(studio.id, id, input);
  else await createPackage(studio.id, input);
  revalidatePath("/studio/packages");
  return { ok: true, message: id ? "Package saved." : "Package added." };
}

export async function archivePackageAction(formData: FormData) {
  const { studio } = await requireWritableStudio("admin");
  const id = str(formData, "id", 64);
  if (str(formData, "active", 5) === "true") await updatePackage(studio.id, id, { isActive: true });
  else await archivePackage(studio.id, id);
  revalidatePath("/studio/packages");
}

export async function reorderPackagesAction(formData: FormData) {
  const { studio } = await requireWritableStudio("admin");
  const ids = str(formData, "order", 4000).split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length) await reorderPackages(studio.id, ids);
  revalidatePath("/studio/packages");
}
