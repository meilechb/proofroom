"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { markLeadContacted } from "@/lib/admin";

export async function markLeadAction(id: string, contacted: boolean) {
  await requirePlatformAdmin();
  await markLeadContacted(id, contacted);
  revalidatePath("/admin/leads");
}
