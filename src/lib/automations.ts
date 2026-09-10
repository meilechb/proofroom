import "server-only";

import { db, one } from "@/lib/db";
import { renderTemplate } from "@/lib/email-templates";
import { getTemplate } from "@/lib/email-templates-server";
import { sendStudioEmail } from "@/lib/email";
import { studioBaseUrl, galleryUrl } from "@/lib/tenant";
import { formatMoney, type Studio } from "@/lib/types";
import { recordClientEvent } from "@/lib/clients";
import { log } from "@/lib/logger";
import { AUTOMATION_RULES, automationSettings, automationsPaused, type AutomationRule, type RuleDef } from "@/lib/automations-shared";

/**
 * Automation runner (plan 3.83, 16.8). The rule definitions and settings helpers
 * live in automations-shared (client-safe); this module adds the due-target
 * queries and the sender, which touch the database and email service.
 */

export type { AutomationRule, RuleDef, AutomationSettings } from "@/lib/automations-shared";
export { AUTOMATION_RULES, automationSettings, automationsPaused } from "@/lib/automations-shared";

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

// ---- Runner (plan 16.8) ----------------------------------------------------

type StudioRow = Pick<Studio, "id" | "name" | "email" | "slug" | "custom_domain" | "custom_domain_verified_at" | "settings">;

/**
 * Sends the due automation emails. Idempotent: each target is claimed in
 * automation_sends before sending, so a second run (or a crash mid-send) never
 * double-sends. Rules disabled or paused for a studio are skipped. Run daily.
 */
export async function runAutomations() {
  const studios = new Map<string, StudioRow | null>();
  const getStudio = async (id: string) => {
    if (!studios.has(id)) studios.set(id, one<StudioRow>(await db()`select id, name, email, slug, custom_domain, custom_domain_verified_at, settings from studios where id = ${id} and deleted_at is null`));
    return studios.get(id) ?? null;
  };

  const counts: Record<string, number> = {};
  for (const def of AUTOMATION_RULES) {
    let sent = 0;
    const targets = await dueTargets(def.rule);
    for (const t of targets) {
      const studio = await getStudio(t.studio_id);
      if (!studio) continue;
      const settings = automationSettings(studio.settings);
      if (automationsPaused(studio.settings) || !settings[def.rule].enabled) continue;
      // Claim the target first so nothing double-sends.
      if (!(await markSent(t.studio_id, def.rule, t.target))) continue;
      try {
        const done = await sendAutomation(def, studio, t);
        if (done) {
          sent++;
          // Show the send on the client's timeline (plan 16.9).
          if (t.client_id && def.rule !== "unanswered_note") {
            await recordClientEvent(t.studio_id, t.client_id, `automation.${def.rule}`, "order", t.ref_id, `Automatic email sent: ${def.label}`).catch(() => {});
          }
        }
      } catch (error) {
        log.warn("automation.send_failed", { rule: def.rule, target: t.target, error: error instanceof Error ? error.message : String(error) });
      }
    }
    counts[def.rule] = sent;
  }
  return counts;
}

async function sendAutomation(def: RuleDef, studio: StudioRow, target: DueTarget): Promise<boolean> {
  const base = studioBaseUrl(studio);
  const globals = { studio_name: studio.name, studio_email: studio.email };

  // The one internal rule: nudge the studio, not the client.
  if (def.rule === "unanswered_note") {
    const res = await sendStudioEmail(studio, {
      to: studio.email,
      subject: "A client note is waiting for a reply",
      text: `A client left a note on a gallery ${settingsDays(studio, def)} or more days ago and it is still open.\n\nOpen the gallery to reply: ${base}/g\n\n${studio.name}`,
      kind: "automation_unanswered_note",
    });
    return res.ok;
  }

  const tmpl = await getTemplate(studio.id, def.template);
  let vars: Record<string, string> = { ...globals };
  let to: string | null = null;
  let ctaUrl: string | null = null;

  if (def.rule === "gallery_expiring") {
    const g = one<{ slug: string; expires_at: string | null; name: string; email: string }>(
      await db()`select g.slug, g.expires_at::text, c.name, c.email from galleries g join clients c on c.id = g.client_id where g.id = ${target.target} and g.studio_id = ${studio.id}`
    );
    if (!g?.email || !g.expires_at) return false;
    to = g.email;
    ctaUrl = galleryUrl(studio, g.slug);
    const daysLeft = Math.max(0, Math.ceil((new Date(g.expires_at).getTime() - Date.now()) / 86400000));
    vars = { ...vars, client_name: g.name, gallery_url: ctaUrl, days_left: String(daysLeft), expires_on: new Date(g.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) };
  } else if (def.rule === "balance_reminder") {
    const o = one<{ id: string; title: string; amount_cents: number; currency: string; name: string; email: string }>(
      await db()`select o.id, o.title, o.amount_cents, o.currency, c.name, c.email from orders o join clients c on c.id = o.client_id where o.id = ${target.target} and o.studio_id = ${studio.id}`
    );
    if (!o?.email) return false;
    to = o.email;
    ctaUrl = `${base}/pay/${o.id}`;
    vars = { ...vars, client_name: o.name, amount: formatMoney(o.amount_cents, o.currency), pay_url: ctaUrl };
  } else if (def.rule === "session_reminder") {
    const o = one<{ title: string; scheduled_at: string | null; location: string | null; name: string; email: string }>(
      await db()`select o.title, o.scheduled_at::text, o.location, c.name, c.email from orders o join clients c on c.id = o.client_id where o.id = ${target.target} and o.studio_id = ${studio.id}`
    );
    if (!o?.email || !o.scheduled_at) return false;
    to = o.email;
    const when = new Date(o.scheduled_at);
    vars = { ...vars, client_name: o.name, session_title: o.title, session_date: when.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }), session_time: when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }), location: o.location ?? "" };
  } else if (def.rule === "thank_you" || def.rule === "review_request") {
    const o = one<{ name: string; email: string }>(
      await db()`select c.name, c.email from orders o join clients c on c.id = o.client_id where o.id = ${target.target} and o.studio_id = ${studio.id}`
    );
    if (!o?.email) return false;
    to = o.email;
    const reviewUrl = (typeof studio.settings.review_url === "string" && studio.settings.review_url) || `${base}/`;
    ctaUrl = def.rule === "review_request" ? reviewUrl : null;
    vars = { ...vars, client_name: o.name, review_url: reviewUrl };
  }

  if (!to) return false;
  const subject = renderTemplate(tmpl.values.subject, vars);
  const body = renderTemplate(tmpl.values.body, vars);
  const res = await sendStudioEmail(studio, {
    to,
    subject,
    text: body,
    cta: tmpl.values.cta_label && ctaUrl ? { label: tmpl.values.cta_label, url: ctaUrl } : undefined,
    kind: `automation_${def.rule}`,
    templateKey: def.template,
    related: { type: "order", id: target.ref_id },
  });
  return res.ok;
}

function settingsDays(studio: StudioRow, def: RuleDef) {
  return automationSettings(studio.settings)[def.rule].days;
}
