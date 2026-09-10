import "server-only";

import { db, one } from "@/lib/db";

/** Session planning (plan 3.91): notes, shot list, mood board on an order; optionally visible to the client. */

export type ShotItem = { id: string; text: string; done: boolean };
export type SessionPlan = { order_id: string; studio_id: string; notes_md: string; shot_list: ShotItem[]; mood_asset_ids: string[]; client_visible: boolean; updated_at: string };

export const SHOT_LIST_TEMPLATES: Record<string, string[]> = {
  headshot: ["Classic head and shoulders, neutral background", "Three-quarter, arms crossed", "Seated, relaxed", "Laughing or candid", "Outfit change: second look", "Full length"],
  team: ["Consistent background test frame", "Each person: straight on", "Each person: slight angle", "Group shot", "Leadership group"],
  actor: ["Commercial look, bright", "Theatrical look, moody", "Character look", "Full length in motion", "Close crop eyes"],
};

export async function getPlan(studioId: string, orderId: string) {
  return one<SessionPlan>(await db()`select * from session_plans where order_id = ${orderId} and studio_id = ${studioId}`);
}

export async function upsertPlan(studioId: string, orderId: string, patch: Partial<Pick<SessionPlan, "notes_md" | "shot_list" | "mood_asset_ids" | "client_visible">>) {
  const current = await getPlan(studioId, orderId);
  const notes = patch.notes_md ?? current?.notes_md ?? "";
  const shots = patch.shot_list ?? current?.shot_list ?? [];
  const mood = patch.mood_asset_ids ?? current?.mood_asset_ids ?? [];
  const visible = patch.client_visible ?? current?.client_visible ?? false;
  return one<SessionPlan>(
    await db()`
      insert into session_plans (order_id, studio_id, notes_md, shot_list, mood_asset_ids, client_visible)
      select ${orderId}, ${studioId}, ${notes}, ${JSON.stringify(shots)}::jsonb, ${mood}::uuid[], ${visible}
      from orders where id = ${orderId} and studio_id = ${studioId}
      on conflict (order_id) do update set notes_md = excluded.notes_md, shot_list = excluded.shot_list, mood_asset_ids = excluded.mood_asset_ids, client_visible = excluded.client_visible
      returning *`
  );
}

export function toggleShot(list: ShotItem[], id: string): ShotItem[] {
  return list.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
}

export function addShots(list: ShotItem[], texts: string[]): ShotItem[] {
  const existing = new Set(list.map((s) => s.text.toLowerCase()));
  const fresh = texts.map((t) => t.trim()).filter((t) => t && !existing.has(t.toLowerCase()));
  return [...list, ...fresh.map((text, i) => ({ id: `${Date.now().toString(36)}${i}`, text, done: false }))];
}

/** Whether a plan has anything worth sharing (gates the share action, plan 21.18). */
export function planHasContent(plan: Pick<SessionPlan, "notes_md" | "shot_list" | "mood_asset_ids"> | null | undefined): boolean {
  return Boolean(plan && (plan.notes_md.trim() !== "" || plan.shot_list.length > 0 || plan.mood_asset_ids.length > 0));
}
