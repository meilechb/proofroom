import "server-only";

import { db, one, rows } from "@/lib/db";
import { sendStudioEmail } from "@/lib/email";
import { signLink } from "@/lib/tenant-tokens";
import { unsubscribeUrl } from "@/lib/tenant";
import type { Broadcast } from "@/lib/types";

/**
 * Broadcasts (S22.5): one-off email campaigns to a studio's buyers or clients.
 * Recipients are enqueued into broadcast_recipients (one row per address, unique
 * per broadcast) so a large send fired in chunks by the cron reaches each once.
 * Suppressions and unsubscribes are honoured by sendStudioEmail; every send
 * carries a one-click unsubscribe link.
 */

export type BroadcastAudience = "buyers" | "clients";

export function broadcastAudience(filter: Record<string, unknown> | null | undefined): BroadcastAudience {
  return filter?.audience === "clients" ? "clients" : "buyers";
}

export async function listBroadcasts(studioId: string) {
  return rows<Broadcast>(await db()`select * from broadcasts where studio_id = ${studioId} order by created_at desc`);
}

export async function getBroadcast(studioId: string, id: string) {
  return one<Broadcast>(await db()`select * from broadcasts where id = ${id} and studio_id = ${studioId}`);
}

export async function createBroadcast(studioId: string, userId: string | null, input: { subject: string; body: string; audience: BroadcastAudience }) {
  return one<Broadcast>(
    await db()`
      insert into broadcasts (studio_id, subject, body, filter, created_by)
      values (${studioId}, ${input.subject}, ${input.body}, ${JSON.stringify({ audience: input.audience })}::jsonb, ${userId})
      returning *`
  );
}

/** Edit a draft only; a scheduled/sent broadcast is immutable. */
export async function updateBroadcast(studioId: string, id: string, input: { subject: string; body: string; audience: BroadcastAudience }) {
  return one<Broadcast>(
    await db()`
      update broadcasts set subject = ${input.subject}, body = ${input.body}, filter = ${JSON.stringify({ audience: input.audience })}::jsonb, updated_at = now()
      where id = ${id} and studio_id = ${studioId} and status = 'draft' returning *`
  );
}

export async function deleteBroadcast(studioId: string, id: string) {
  await db()`delete from broadcasts where id = ${id} and studio_id = ${studioId} and status in ('draft', 'cancelled')`;
}

/** Stop a draft or a not-yet-started scheduled broadcast. */
export async function cancelBroadcast(studioId: string, id: string) {
  await db()`update broadcasts set status = 'cancelled', updated_at = now() where id = ${id} and studio_id = ${studioId} and status in ('draft', 'scheduled')`;
}

/** Recipients for an audience: clients with an email who have not unsubscribed. */
async function audienceRecipients(studioId: string, audience: BroadcastAudience) {
  if (audience === "buyers") {
    return rows<{ client_id: string; email: string }>(
      await db()`
        select distinct on (lower(c.email)) c.id as client_id, lower(c.email) as email
        from sales s join clients c on c.id = s.buyer_client_id
        where s.studio_id = ${studioId} and s.status in ('paid', 'partially_refunded') and c.email <> '' and c.unsubscribed_at is null
        order by lower(c.email)`
    );
  }
  return rows<{ client_id: string; email: string }>(
    await db()`select id as client_id, lower(email) as email from clients where studio_id = ${studioId} and email <> '' and unsubscribed_at is null order by lower(email)`
  );
}

/** How many recipients an audience would reach right now (for the compose preview). */
export async function audienceCount(studioId: string, audience: BroadcastAudience) {
  return (await audienceRecipients(studioId, audience)).length;
}

/**
 * Enqueue recipients and hand the broadcast to the cron: `sending` now, or
 * `scheduled` for later. Draft only; idempotent on the recipient rows.
 */
export async function startBroadcast(studioId: string, id: string, opts: { scheduledAt?: string | null } = {}) {
  const b = await getBroadcast(studioId, id);
  if (!b || b.status !== "draft") throw new Error("Not found");
  const recipients = await audienceRecipients(studioId, broadcastAudience(b.filter));
  if (recipients.length === 0) throw new Error("No recipients for this audience yet.");
  for (const r of recipients) {
    await db()`insert into broadcast_recipients (studio_id, broadcast_id, client_id, email) values (${studioId}, ${id}, ${r.client_id}, ${r.email}) on conflict (broadcast_id, email) do nothing`;
  }
  const status = opts.scheduledAt ? "scheduled" : "sending";
  await db()`update broadcasts set status = ${status}, scheduled_at = ${opts.scheduledAt ?? null}, recipient_count = ${recipients.length}, updated_at = now() where id = ${id} and studio_id = ${studioId} and status = 'draft'`;
}

type SendingRow = Broadcast & { name: string; studio_email: string; slug: string; custom_domain: string | null; custom_domain_verified_at: string | null };

/**
 * Cron step: promote due scheduled broadcasts, then send a chunk of pending
 * recipients for each `sending` broadcast. Each recipient is claimed atomically
 * (pending → sent) before the send, so a re-run never double-sends. A broadcast
 * with nothing pending left is marked `sent`.
 */
export async function processBroadcasts(chunk = 100) {
  await db()`update broadcasts set status = 'sending', updated_at = now() where status = 'scheduled' and scheduled_at is not null and scheduled_at <= now()`;
  const sending = rows<SendingRow>(
    await db()`
      select b.*, st.name, st.email as studio_email, st.slug, st.custom_domain, st.custom_domain_verified_at::text
      from broadcasts b join studios st on st.id = b.studio_id
      where b.status = 'sending' and st.deleted_at is null order by b.updated_at limit 10`
  );
  let sent = 0;
  for (const b of sending) {
    const pending = rows<{ id: string; client_id: string | null; email: string }>(
      await db()`select id, client_id, email from broadcast_recipients where broadcast_id = ${b.id} and status = 'pending' order by created_at limit ${chunk}`
    );
    if (pending.length === 0) {
      await db()`update broadcasts set status = 'sent', sent_at = now(), updated_at = now() where id = ${b.id} and status = 'sending'`;
      continue;
    }
    const studio = { id: b.studio_id, name: b.name, email: b.studio_email };
    const host = { slug: b.slug, custom_domain: b.custom_domain, custom_domain_verified_at: b.custom_domain_verified_at };
    for (const r of pending) {
      const claimed = await db()`update broadcast_recipients set status = 'sent', sent_at = now() where id = ${r.id} and status = 'pending' returning id`;
      if (claimed.length === 0) continue; // another worker took it
      const unsub = r.client_id ? unsubscribeUrl(host, signLink("unsub", r.client_id)) : null;
      const res = await sendStudioEmail(studio, { to: r.email, subject: b.subject, text: b.body, unsubscribeUrl: unsub, kind: "broadcast", templateKey: "broadcast" }).catch(() => null);
      if (res && res.ok) {
        await db()`update broadcasts set sent_count = sent_count + 1 where id = ${b.id}`;
        sent++;
      } else {
        await db()`update broadcast_recipients set status = ${res?.skipped ? "skipped" : "failed"} where id = ${r.id}`;
      }
    }
  }
  return sent;
}
