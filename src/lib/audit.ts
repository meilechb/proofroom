import "server-only";

import { db, dbConfigured, rows } from "@/lib/db";

export type AuditInput = {
  studioId?: string | null;
  actorUserId?: string | null;
  actorLabel?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

export type AuditRow = { id: string; actor_user_id: string | null; actor_name: string | null; actor_label: string | null; action: string; target_type: string | null; target_id: string | null; metadata: Record<string, unknown> | null; created_at: string };

/** The studio's audit trail with optional filters (plan 17.8). */
export async function listAuditLog(studioId: string, opts: { actor?: string; action?: string; since?: string; limit?: number } = {}) {
  const actor = opts.actor || null;
  const actionLike = opts.action?.trim() ? `%${opts.action.trim().toLowerCase()}%` : null;
  const since = opts.since || null;
  const limit = Math.min(opts.limit ?? 200, 500);
  return rows<AuditRow>(
    await db()`
      select a.id::text, a.actor_user_id, u.name as actor_name, a.actor_label, a.action, a.target_type, a.target_id, a.metadata, a.created_at::text
      from audit_log a left join users u on u.id = a.actor_user_id
      where a.studio_id = ${studioId}
        and (${actor}::uuid is null or a.actor_user_id = ${actor}::uuid)
        and (${actionLike}::text is null or lower(a.action) like ${actionLike})
        and (${since}::timestamptz is null or a.created_at >= ${since}::timestamptz)
      order by a.id desc
      limit ${limit}`
  );
}

/** Distinct actors and actions for the filter menus. */
export async function auditFacets(studioId: string) {
  const actors = rows<{ id: string; name: string | null }>(await db()`select distinct u.id, u.name from audit_log a join users u on u.id = a.actor_user_id where a.studio_id = ${studioId} and a.actor_user_id is not null order by u.name`);
  const actions = rows<{ action: string }>(await db()`select distinct action from audit_log where studio_id = ${studioId} order by action`);
  return { actors, actions: actions.map((a) => a.action) };
}

/** Append-only audit trail. Never throws; auditing must not break the action. */
export async function audit(input: AuditInput) {
  if (!dbConfigured()) return;
  try {
    await db()`
      insert into audit_log (studio_id, actor_user_id, actor_label, action, target_type, target_id, metadata, ip)
      values (${input.studioId ?? null}, ${input.actorUserId ?? null}, ${input.actorLabel ?? null},
              ${input.action}, ${input.targetType ?? null}, ${input.targetId ?? null},
              ${input.metadata ? JSON.stringify(input.metadata) : null}, ${input.ip ?? null})`;
  } catch (error) {
    console.error("audit_log insert failed", error);
  }
}
