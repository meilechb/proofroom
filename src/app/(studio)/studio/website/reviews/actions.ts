"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { db, one } from "@/lib/db";
import { str, int, type ActionState } from "@/lib/action-state";

export async function addReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio("admin");
  const name = str(formData, "name", 120);
  const body = str(formData, "body", 2000);
  if (name.length < 1 || body.length < 3) return { error: "Add a name and the review text." };
  const rating = Math.min(5, Math.max(1, int(formData, "rating", 5)));
  const next = one<{ n: number }>(await db()`select coalesce(max(sort_order),0)+1 as n from reviews where studio_id = ${studio.id}`);
  await db()`insert into reviews (studio_id, name, body, rating, source, sort_order) values (${studio.id}, ${name}, ${body}, ${rating}, ${str(formData, "source", 80) || null}, ${next?.n ?? 1})`;
  revalidatePath("/studio/website/reviews");
  return { ok: true, message: "Review added." };
}

export async function toggleReviewAction(formData: FormData) {
  const { studio } = await requireWritableStudio("admin");
  await db()`update reviews set is_published = ${str(formData, "publish", 5) === "true"} where id = ${str(formData, "id", 64)} and studio_id = ${studio.id}`;
  revalidatePath("/studio/website/reviews");
}

export async function deleteReviewAction(formData: FormData) {
  const { studio } = await requireWritableStudio("admin");
  await db()`delete from reviews where id = ${str(formData, "id", 64)} and studio_id = ${studio.id}`;
  revalidatePath("/studio/website/reviews");
}

export async function moveReviewAction(formData: FormData) {
  const { studio } = await requireWritableStudio("admin");
  const id = str(formData, "id", 64);
  const dir = str(formData, "dir", 4) === "up" ? -1 : 1;
  const rows = (await db()`select id, sort_order from reviews where studio_id = ${studio.id} order by sort_order, created_at`) as { id: string; sort_order: number }[];
  const idx = rows.findIndex((r) => r.id === id);
  const swap = idx + dir;
  if (idx >= 0 && swap >= 0 && swap < rows.length) {
    await db()`update reviews set sort_order = ${rows[swap].sort_order} where id = ${rows[idx].id}`;
    await db()`update reviews set sort_order = ${rows[idx].sort_order} where id = ${rows[swap].id}`;
  }
  revalidatePath("/studio/website/reviews");
}
