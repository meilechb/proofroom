"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { db, one } from "@/lib/db";
import { normalizeSlug } from "@/lib/slug";
import { str, type ActionState } from "@/lib/action-state";

export async function addAreaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio("admin");
  const town = str(formData, "town", 80);
  if (town.length < 2) return { error: "Enter a town or city name." };
  const slug = normalizeSlug(town);
  if (!slug) return { error: "That name can't be turned into a web address." };
  const exists = one<{ id: string }>(await db()`select id from site_areas where studio_id = ${studio.id} and slug = ${slug}`);
  if (exists) return { error: "You already have an area with that address." };
  const next = one<{ n: number }>(await db()`select coalesce(max(sort_order),0)+1 as n from site_areas where studio_id = ${studio.id}`);
  await db()`insert into site_areas (studio_id, town, slug, intro_override, sort_order) values (${studio.id}, ${town}, ${slug}, ${str(formData, "intro", 1200) || null}, ${next?.n ?? 1})`;
  revalidatePath("/studio/website/areas");
  return { ok: true, message: `${town} added.` };
}

export async function toggleAreaAction(formData: FormData) {
  const { studio } = await requireWritableStudio("admin");
  await db()`update site_areas set is_published = ${str(formData, "publish", 5) === "true"} where id = ${str(formData, "id", 64)} and studio_id = ${studio.id}`;
  revalidatePath("/studio/website/areas");
}

export async function deleteAreaAction(formData: FormData) {
  const { studio } = await requireWritableStudio("admin");
  await db()`delete from site_areas where id = ${str(formData, "id", 64)} and studio_id = ${studio.id}`;
  revalidatePath("/studio/website/areas");
}
