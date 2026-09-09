import "server-only";

import { db } from "@/lib/db";
import type { TemplateKey } from "@/lib/email-templates";

/**
 * Automation rules (plan 3.83). Each rule names a template, a default delay
 * and a query that returns the targets due now. Sends are recorded in
 * automation_sends so a rule fires at most once per target. Settings live in
 * studios.settings.automations = { [rule]: { enabled: boolean, days: number } }.
 */

export type AutomationRule = "balance_reminder" | "gallery_expiring" | "unanswered_note" | "thank_you" | "review_request" | "session_reminder";

export type RuleDef = { rule: AutomationRule; template: TemplateKey; label: string; defaultDays: number; defaultEnabled: boolean; description: string };

export const AUTOMATION_RULES: RuleDef[] = [
  { rule: "balance_reminder", template: "balance_reminder", label: "Remind about an unpaid balance", defaultDays: 3, defaultEnabled: true, description: "Days after finals are delivered while the balance is still unpaid." },
  { rule: "gallery_expiring", template: "gallery_expiring", label: "Warn before a gallery closes", defaultDays: 7, defaultEnabled: true, description: "Days before a gallery's expiry date." },
  { rule: "unanswered_note", template: "inquiry_reply", label: "Nudge you about unanswered client notes", defaultDays: 2, defaultEnabled: true, description: "Days a client note has waited without a reply (sent to you, not the client)." },
  { rule: "thank_you", template: "thank_you", label: "Send a thank-you note", defaultDays: 2, defaultEnabled: false, description: "Days after the final gallery is delivered and paid." },
  { rule: "review_request", template: "review_request", label: "Ask for a review", defaultDays: 7, defaultEnabled: false, description: "Days after delivery." },
  { rule: "session_reminder", template: "booking_reminder", label: "Remind clients the day before", defaultDays: 1, defaultEnabled: true, description: "Days before the session." },
];

export type AutomationSettings = Record<AutomationRule, { enabled: boolean; days: number }>;

export function automationSettings(settings: Record<string, unknown> | null | undefined): AutomationSettings {
  const raw = (settings?.automations ?? {}) as Partial<Record<AutomationRule, { enabled?: boolean; days?: number }>>;
  const out = {} as AutomationSettings;
  for (const def of AUTOMATION_RULES) {
    const v = raw[def.rule] ?? {};
    out[def.rule] = { enabled: v.enabled ?? def.defaultEnabled, days: Math.min(60, Math.max(0, Math.round(v.days ?? def.defaultDays))) };
  }
  return out;
}

export function automationsPaused(settings: Record<string, unknown> | null | undefined) {
  return Boolean((settings as { automations_paused?: boolean } | null | undefined)?.automations_paused);
}

/** Records a send; returns false when this rule already fired for the target. */
export async function markSent(studioId: string, rule: AutomationRule, target: string) {
  const inserted = await db()`insert into automation_sends (studio_id, rule, target) values (${studioId}, ${rule}, ${target}) on conflict do nothing returning rule`;
  return inserted.length > 0;
}

export type DueTarget = { studio_id: string; target: string; client_id: string | null; ref_id: string };

/** Targets due for a rule across all studios; the cron sends and marks each. */
export async function dueTargets(rule: AutomationRule): Promise<DueTarget[]> {
  switch (rule) {
    case "balance_reminder":
      return (await db()`
        select o.studio_id, o.id as target, o.client_id, o.id as ref_id
        from orders o join studios s on s.id = o.studio_id
        join galleries g on g.order_id = o.id and g.kind = 'final' and g.status = 'published'
        where o.paid_at is null and o.status not in ('cancelled','draft')
          and g.published_at < now() - ((coalesce((s.settings->'automations'->'balance_reminder'->>'days')::int, 3)) || ' days')::interval
          and not exists (select 1 from automation_sends a where a.studio_id = o.studio_id and a.rule = 'balance_reminder' and a.target = o.id::text)`) as DueTarget[];
    case "gallery_expiring":
      return (await db()`
        select g.studio_id, g.id as target, g.client_id, g.id as ref_id
        from galleries g join studios s on s.id = g.studio_id
        where g.status = 'published' and g.expires_at is not null
          and g.expires_at between now() and now() + ((coalesce((s.settings->'automations'->'gallery_expiring'->>'days')::int, 7)) || ' days')::interval
          and not exists (select 1 from automation_sends a where a.studio_id = g.studio_id and a.rule = 'gallery_expiring' and a.target = g.id::text)`) as DueTarget[];
    case "unanswered_note":
      return (await db()`
        select c.studio_id, c.id as target, g.client_id, c.gallery_id as ref_id
        from photo_comments c join galleries g on g.id = c.gallery_id join studios s on s.id = c.studio_id
        where c.author_role = 'client' and not c.resolved
          and c.created_at < now() - ((coalesce((s.settings->'automations'->'unanswered_note'->>'days')::int, 2)) || ' days')::interval
          and not exists (select 1 from automation_sends a where a.studio_id = c.studio_id and a.rule = 'unanswered_note' and a.target = c.id::text)`) as DueTarget[];
    case "thank_you":
    case "review_request":
      return (await db()`
        select o.studio_id, o.id as target, o.client_id, o.id as ref_id
        from orders o join studios s on s.id = o.studio_id
        join galleries g on g.order_id = o.id and g.kind = 'final' and g.status = 'published'
        where o.paid_at is not null
          and g.published_at < now() - ((coalesce((s.settings->'automations'->${rule}->>'days')::int, ${rule === "thank_you" ? 2 : 7})) || ' days')::interval
          and not exists (select 1 from automation_sends a where a.studio_id = o.studio_id and a.rule = ${rule} and a.target = o.id::text)`) as DueTarget[];
    case "session_reminder":
      return (await db()`
        select o.studio_id, o.id as target, o.client_id, o.id as ref_id
        from orders o join studios s on s.id = o.studio_id
        where o.scheduled_at is not null and o.status not in ('cancelled','draft','completed')
          and o.scheduled_at between now() and now() + ((coalesce((s.settings->'automations'->'session_reminder'->>'days')::int, 1)) || ' days')::interval
          and not exists (select 1 from automation_sends a where a.studio_id = o.studio_id and a.rule = 'session_reminder' and a.target = o.id::text)`) as DueTarget[];
  }
}
