"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { createApiToken, revokeApiToken } from "@/lib/api-tokens";
import { audit } from "@/lib/audit";

export type CreateTokenResult = { ok: true; token: string } | { ok: false; error: string };

export async function createTokenAction(name: string): Promise<CreateTokenResult> {
  const { studio, user } = await requireWritableStudio("admin");
  const clean = name.trim().slice(0, 80) || "Lightroom";
  const { token } = await createApiToken(studio.id, user.id, clean);
  await audit({ studioId: studio.id, actorUserId: user.id, action: "api_token.created", metadata: { name: clean } });
  revalidatePath("/studio/settings/lightroom");
  return { ok: true, token };
}

export async function revokeTokenAction(id: string): Promise<void> {
  const { studio, user } = await requireWritableStudio("admin");
  await revokeApiToken(studio.id, id);
  await audit({ studioId: studio.id, actorUserId: user.id, action: "api_token.revoked", targetId: id });
  revalidatePath("/studio/settings/lightroom");
}
