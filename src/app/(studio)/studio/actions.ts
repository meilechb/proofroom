"use server";

import { revalidatePath } from "next/cache";
import { requireStudio } from "@/lib/auth";
import { db } from "@/lib/db";

export async function dismissOnboardingAction() {
  const { studio } = await requireStudio();
  await db()`update studios set onboarding = onboarding || '{"dismissed": true}'::jsonb, updated_at = now() where id = ${studio.id}`;
  revalidatePath("/studio");
}
