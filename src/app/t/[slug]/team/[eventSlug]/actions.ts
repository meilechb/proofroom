"use server";

import { headers } from "next/headers";
import { db, one } from "@/lib/db";
import { studioBySlug, galleryBySlug } from "@/lib/tenant-data";
import { grantGalleryAccess, unlockAttemptAllowed, verifyUnlock } from "@/lib/gallery-access";
import { clientIp } from "@/lib/rate-limit";
import { str, type ActionState } from "@/lib/action-state";

/** Manager unlocks a team event with the event's access code (plan 13.17). */
export async function unlockTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = str(formData, "slug", 80);
  const eventSlug = str(formData, "eventSlug", 120);
  const studio = await studioBySlug(slug);
  if (!studio) return { error: "Not found." };
  const parent = await galleryBySlug(studio.id, eventSlug);
  if (!parent) return { error: "Not found." };
  if (!unlockAttemptAllowed(parent.id, clientIp(await headers()))) return { error: "Too many tries. Wait a few minutes." };
  if (!verifyUnlock(parent, str(formData, "code", 100))) return { error: "That manager code is not right." };
  await grantGalleryAccess(parent.id);
  return { ok: true };
}
