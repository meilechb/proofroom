import "server-only";

import { db, dbConfigured } from "@/lib/db";

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
