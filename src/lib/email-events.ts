import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { db, one, rows } from "@/lib/db";
import { addSuppression } from "@/lib/suppressions";
import { log } from "@/lib/logger";

/**
 * Resend delivery webhooks (plan 16.5). Resend signs with Svix; we verify the
 * signature manually (docs read 2026-09-10): decode the base64 secret after the
 * `whsec_` prefix, HMAC-SHA256 over `${id}.${timestamp}.${body}`, base64-encode,
 * and compare to any `v1,` entry in the svix-signature header. Then we mirror the
 * event into email_log and suppress hard bounces and complaints.
 */

const TOLERANCE_SECONDS = 5 * 60;

export function verifySvixSignature(secret: string, headers: { id: string | null; timestamp: string | null; signature: string | null }, body: string): boolean {
  if (!headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signed = `${headers.id}.${headers.timestamp}.${body}`;
  const expected = createHmac("sha256", secretBytes).update(signed).digest("base64");
  const expectedBuf = Buffer.from(expected);
  for (const part of headers.signature.split(" ")) {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) continue;
    const candidate = Buffer.from(value);
    if (candidate.length === expectedBuf.length && timingSafeEqual(candidate, expectedBuf)) return true;
  }
  return false;
}

type ResendEvent = {
  type: string;
  created_at?: string;
  data?: { email_id?: string; to?: string | string[]; bounce?: { type?: string }; [k: string]: unknown };
};

const EVENT_COLUMN: Record<string, string> = {
  "email.delivered": "delivered_at",
  "email.opened": "opened_at",
  "email.clicked": "clicked_at",
  "email.bounced": "bounced_at",
  "email.complained": "complained_at",
};

/** Apply one Resend event to email_log, and suppress on hard bounce or complaint. */
export async function applyResendEvent(event: ResendEvent) {
  const type = event.type;
  if (type === "domain.updated" || type === "domain.created") {
    const data = event.data as { id?: string; status?: string; records?: unknown } | undefined;
    if (data?.id && data.status) {
      const { applyDomainWebhook } = await import("@/lib/sending-domains");
      await applyDomainWebhook(data.id, data.status, Array.isArray(data.records) ? (data.records as never[]) : undefined);
    }
    return;
  }
  const column = EVENT_COLUMN[type];
  const providerId = event.data?.email_id;
  if (!column || !providerId) return;

  const row = one<{ id: string; studio_id: string | null; to_address: string }>(
    await db()`select id, studio_id, to_address from email_log where provider_id = ${providerId} limit 1`
  );
  const eventLabel = type.replace("email.", "");
  if (row) {
    // Set the event timestamp (kept once) and the latest event label.
    if (column === "delivered_at") await db()`update email_log set delivered_at = coalesce(delivered_at, now()), last_event = ${eventLabel} where id = ${row.id}`;
    else if (column === "opened_at") await db()`update email_log set opened_at = coalesce(opened_at, now()), last_event = ${eventLabel} where id = ${row.id}`;
    else if (column === "clicked_at") await db()`update email_log set clicked_at = coalesce(clicked_at, now()), last_event = ${eventLabel} where id = ${row.id}`;
    else if (column === "bounced_at") await db()`update email_log set bounced_at = coalesce(bounced_at, now()), last_event = ${eventLabel} where id = ${row.id}`;
    else if (column === "complained_at") await db()`update email_log set complained_at = coalesce(complained_at, now()), last_event = ${eventLabel} where id = ${row.id}`;
  }

  // Suppress the address on a hard bounce or a complaint so we stop mailing it.
  const hardBounce = type === "email.bounced" && (event.data?.bounce?.type ?? "").toLowerCase().includes("hard");
  const complaint = type === "email.complained";
  if ((hardBounce || complaint) && row?.studio_id) {
    await addSuppression(row.studio_id, row.to_address, complaint ? "complaint" : "bounce");
    log.info("email.suppressed", { studio: row.studio_id, reason: complaint ? "complaint" : "bounce" });
  }
}

// ---- Email log queries (plan 16.4) -----------------------------------------

export type EmailLogRow = {
  id: string; kind: string | null; to_address: string; subject: string; body: string | null; status: string;
  error: string | null; template_key: string | null; last_event: string | null;
  delivered_at: string | null; opened_at: string | null; clicked_at: string | null; bounced_at: string | null; complained_at: string | null;
  created_at: string;
};

export async function listEmailLog(studioId: string, opts: { status?: string; template?: string; q?: string; limit?: number } = {}) {
  const status = opts.status && ["sent", "failed", "skipped"].includes(opts.status) ? opts.status : null;
  const template = opts.template || null;
  const like = opts.q?.trim() ? `%${opts.q.trim().toLowerCase()}%` : null;
  const limit = Math.min(opts.limit ?? 100, 200);
  return rows<EmailLogRow>(
    await db()`
      select id, kind, to_address, subject, body, status, error, template_key, last_event,
        delivered_at::text, opened_at::text, clicked_at::text, bounced_at::text, complained_at::text, created_at::text
      from email_log
      where studio_id = ${studioId}
        and (${status}::text is null or status = ${status})
        and (${template}::text is null or template_key = ${template})
        and (${like}::text is null or lower(to_address) like ${like} or lower(subject) like ${like})
      order by created_at desc
      limit ${limit}`
  );
}

export async function getEmailLogEntry(studioId: string, id: string) {
  return one<EmailLogRow>(
    await db()`
      select id, kind, to_address, subject, body, status, error, template_key, last_event,
        delivered_at::text, opened_at::text, clicked_at::text, bounced_at::text, complained_at::text, created_at::text
      from email_log where id = ${id} and studio_id = ${studioId}`
  );
}
