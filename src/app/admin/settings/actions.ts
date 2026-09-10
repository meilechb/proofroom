"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { setPlatformSetting } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { str, bool, type ActionState } from "@/lib/action-state";

/** Platform settings: signups, maintenance banner, minimum plugin version (plan 19.9). */
export async function savePlatformSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePlatformAdmin();
  await setPlatformSetting("signups", { open: bool(formData, "signups_open") });
  await setPlatformSetting("maintenance_banner", { text: str(formData, "maintenance_banner", 300) });
  const minVersion = str(formData, "min_plugin_version", 20);
  if (!/^\d+\.\d+\.\d+$/.test(minVersion)) return { error: "Plugin version must look like 1.0.0." };
  await setPlatformSetting("plugin", { min_version: minVersion });
  await audit({ actorUserId: user.id, action: "platform.settings_saved" });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Saved." };
}
