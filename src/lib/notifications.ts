import "server-only";

import { db, one, rows } from "@/lib/db";
import { resolvePrefs, type NotificationKey } from "@/lib/notifications-shared";

/**
 * Per-user notification preferences (plan 17.5). Stored per membership so a user
 * who belongs to two studios can choose differently for each. Keys and defaults
 * live in notifications-shared; send sites call notifiableMembers.
 */

export type { NotificationKey } from "@/lib/notifications-shared";
export { NOTIFICATION_KEYS, resolvePrefs } from "@/lib/notifications-shared";

export async function getNotificationPrefs(userId: string, studioId: string) {
  const row = one<{ notification_prefs: unknown }>(await db()`select notification_prefs from memberships where user_id = ${userId} and studio_id = ${studioId}`);
  return resolvePrefs(row?.notification_prefs);
}

export async function saveNotificationPrefs(userId: string, studioId: string, prefs: Record<NotificationKey, boolean>) {
  await db()`update memberships set notification_prefs = ${JSON.stringify(prefs)}::jsonb where user_id = ${userId} and studio_id = ${studioId}`;
}

/** Members of a studio who want a given notification, with their email (for send sites). */
export async function notifiableMembers(studioId: string, key: NotificationKey) {
  const members = rows<{ user_id: string; email: string; name: string; notification_prefs: unknown }>(
    await db()`select m.user_id, u.email, u.name, m.notification_prefs from memberships m join users u on u.id = m.user_id where m.studio_id = ${studioId}`
  );
  return members.filter((m) => resolvePrefs(m.notification_prefs)[key]).map((m) => ({ userId: m.user_id, email: m.email, name: m.name }));
}
