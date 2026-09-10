"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { suspendStudio, extendTrial, compStudio, forceReadOnly, schedulePurge, cancelPurge } from "@/lib/admin";
import { IMPERSONATE_COOKIE, impersonationValue } from "@/lib/impersonation";
import { audit } from "@/lib/audit";

async function act(id: string, action: string, run: () => Promise<void>) {
  const user = await requirePlatformAdmin();
  await run();
  await audit({ studioId: id, actorUserId: user.id, action: `admin.${action}` });
  revalidatePath(`/admin/studios/${id}`);
  revalidatePath("/admin");
}

export async function suspendStudioAction(id: string, suspend: boolean) { await act(id, suspend ? "suspend" : "unsuspend", () => suspendStudio(id, suspend)); }
export async function extendTrialAction(id: string, days: number) { await act(id, "extend_trial", () => extendTrial(id, days)); }
export async function compStudioAction(id: string, comp: boolean) { await act(id, comp ? "comp" : "uncomp", () => compStudio(id, comp)); }
export async function forceReadOnlyAction(id: string, on: boolean) { await act(id, on ? "force_read_only" : "clear_read_only", () => forceReadOnly(id, on)); }
export async function schedulePurgeAction(id: string, days: number) { await act(id, "schedule_purge", () => schedulePurge(id, days)); }
export async function cancelPurgeAction(id: string) { await act(id, "cancel_purge", () => cancelPurge(id)); }

/** Start read-only impersonation of a studio (plan 19.4). */
export async function startImpersonationAction(id: string) {
  const user = await requirePlatformAdmin();
  (await cookies()).set(IMPERSONATE_COOKIE, impersonationValue(id), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 });
  await audit({ studioId: id, actorUserId: user.id, action: "admin.impersonate_start" });
  redirect("/studio");
}

export async function stopImpersonationAction() {
  (await cookies()).delete(IMPERSONATE_COOKIE);
  redirect("/admin");
}
