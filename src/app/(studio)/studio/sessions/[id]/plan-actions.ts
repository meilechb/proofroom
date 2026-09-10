"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { db, one, isUuid, rows } from "@/lib/db";
import { upsertPlan, getPlan, planHasContent, type ShotItem } from "@/lib/planning";
import { getOrder } from "@/lib/orders";
import { recordClientEvent } from "@/lib/clients";
import { getTemplate } from "@/lib/email-templates-server";
import { renderTemplate } from "@/lib/email-templates";
import { sendStudioEmail } from "@/lib/email";
import { signLink } from "@/lib/tenant-tokens";
import { clientHubUrl } from "@/lib/tenant";
import type { ActionState } from "@/lib/action-state";
import { log } from "@/lib/logger";

/** Session plan editing and sharing (plan 21.17-21.19). */

export type PlanInput = { notes_md: string; shot_list: ShotItem[]; mood_asset_ids: string[]; client_visible: boolean };

async function ownedAssets(studioId: string, ids: string[]) {
  const clean = ids.filter(isUuid).slice(0, 60);
  if (clean.length === 0) return [];
  const found = rows<{ id: string }>(await db()`select id from assets where studio_id = ${studioId} and id = any(${clean}::uuid[])`);
  const set = new Set(found.map((a) => a.id));
  return clean.filter((id) => set.has(id)); // keep the caller's order
}

export async function savePlanAction(orderId: string, input: PlanInput): Promise<ActionState> {
  const { studio } = await requireWritableStudio();
  if (!isUuid(orderId) || !(await getOrder(studio.id, orderId))) return { error: "Session not found." };
  const notes = String(input.notes_md ?? "").slice(0, 20000);
  const shots: ShotItem[] = Array.isArray(input.shot_list)
    ? input.shot_list.slice(0, 200).map((s) => ({ id: String(s.id).slice(0, 40), text: String(s.text ?? "").trim().slice(0, 300), done: Boolean(s.done) })).filter((s) => s.text)
    : [];
  const mood = await ownedAssets(studio.id, Array.isArray(input.mood_asset_ids) ? input.mood_asset_ids : []);
  await upsertPlan(studio.id, orderId, { notes_md: notes, shot_list: shots, mood_asset_ids: mood, client_visible: Boolean(input.client_visible) });
  revalidatePath(`/studio/sessions/${orderId}`);
  return { ok: true, message: "Plan saved." };
}

/** Marks the plan visible to the client and emails them the link (plan 21.18). */
export async function sharePlanAction(orderId: string): Promise<ActionState> {
  const { studio } = await requireWritableStudio();
  const order = await getOrder(studio.id, orderId);
  if (!order) return { error: "Session not found." };
  const plan = await getPlan(studio.id, orderId);
  if (!planHasContent(plan)) return { error: "Add something to the plan before sharing it." };
  await upsertPlan(studio.id, orderId, { client_visible: true });
  const client = one<{ id: string; name: string; email: string }>(await db()`select id, name, email from clients where id = ${order.client_id} and studio_id = ${studio.id}`);
  if (client?.email) {
    const planUrl = `${clientHubUrl(studio, signLink("hub", client.id))}/plan`;
    const tmpl = await getTemplate(studio.id, "session_plan_shared");
    const when = order.scheduled_at ? new Date(order.scheduled_at).toLocaleDateString("en-US", { timeZone: studio.timezone || "UTC", weekday: "long", month: "long", day: "numeric" }) : "your session";
    const vars = { client_name: client.name, session_title: order.title, session_date: when, plan_url: planUrl };
    await sendStudioEmail(studio, { to: client.email, subject: renderTemplate(tmpl.values.subject, vars), text: renderTemplate(tmpl.values.body, vars), cta: tmpl.values.cta_label ? { label: tmpl.values.cta_label, url: planUrl } : undefined, kind: "session_plan_shared", templateKey: "session_plan_shared", related: { type: "order", id: orderId } }).catch((e) => log.warn("plan.share_email_failed", { error: e instanceof Error ? e.message : String(e) }));
    await recordClientEvent(studio.id, client.id, "plan.shared", "order", orderId, "Session plan shared with the client");
  }
  revalidatePath(`/studio/sessions/${orderId}`);
  return { ok: true, message: "Plan shared with the client." };
}
