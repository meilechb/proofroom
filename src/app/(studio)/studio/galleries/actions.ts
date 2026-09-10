"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { createGallery } from "@/lib/galleries";
import { db, one } from "@/lib/db";
import { str, type ActionState } from "@/lib/action-state";

/** New gallery (plan 12.2). Title defaults to the client name and today's date. */
export async function createGalleryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio();
  const clientId = str(formData, "clientId", 64);
  if (!clientId) return { error: "Pick a client for this gallery.", fields: { clientId: "Choose a client." } };
  const client = one<{ name: string }>(await db()`select name from clients where id = ${clientId} and studio_id = ${studio.id}`);
  if (!client) return { error: "That client was not found." };
  const kind = str(formData, "kind", 10) === "final" ? "final" : "proof";
  const title = str(formData, "title", 120) || `${client.name} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const orderId = str(formData, "orderId", 64) || null;
  const gallery = await createGallery(studio.id, { clientId, orderId, kind, title });
  revalidatePath("/studio/galleries");
  redirect(`/studio/galleries/${gallery.id}`);
}
