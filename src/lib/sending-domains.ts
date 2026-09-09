import "server-only";

import { db, one } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

/**
 * A studio's own sending domain in Resend (plan 3.81). We create the domain by
 * API, show the DNS records Resend returns, ask Resend to verify, and mirror the
 * status from GET /domains/{id} and the domain.updated webhook.
 */

export type ResendRecord = { record: string; name: string; type: string; ttl: string; status: string; value: string; priority?: number };
export type ResendDomain = { id: string; name: string; status: string; region: string; created_at: string; records: ResendRecord[] };

export type SendingDomainStatus = "not_started" | "pending" | "verified" | "failed" | "temporary_failure";

export type SendingDomain = {
  id: string; studio_id: string; domain: string; resend_domain_id: string | null; status: SendingDomainStatus;
  records: ResendRecord[]; from_local_part: string; region: string | null; verified_at: string | null; last_checked_at: string | null; created_at: string; updated_at: string;
};

/**
 * Resend statuses (docs, September 9 2026): not_started, pending, verified,
 * partially_verified, partially_failed, failed, temporary_failure. We only send
 * mail, so a domain that can send counts as verified; anything else maps to
 * the closest of our five states.
 */
export function mapStatus(resendStatus: string): SendingDomainStatus {
  switch (resendStatus) {
    case "verified":
    case "partially_verified":
      return "verified";
    case "pending":
    case "partially_failed":
      return "pending";
    case "failed":
      return "failed";
    case "temporary_failure":
      return "temporary_failure";
    default:
      return "not_started";
  }
}

const RESERVED = new Set(["localhost", "example.com", "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com"]);

/** Validates the domain the studio typed; we recommend a subdomain like mail.studio.com. */
export function domainProblem(input: string): string | null {
  const d = input.trim().toLowerCase();
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) return "Enter a domain like mail.yourstudio.com.";
  if (RESERVED.has(d) || [...RESERVED].some((r) => d.endsWith(`.${r}`))) return "Use a domain you own, not a public mail provider.";
  const app = process.env.NEXT_PUBLIC_APP_DOMAIN?.split(":")[0].toLowerCase();
  if (app && (d === app || d.endsWith(`.${app}`))) return "That is our domain. Use your own.";
  return null;
}

/** Rows for the DNS table: host, type, value, ttl, per-record status (plan 3.81 dnsRows). */
export function dnsRows(records: ResendRecord[]) {
  return records.map((r) => ({
    purpose: r.record,
    host: r.name,
    type: r.type,
    value: r.priority !== undefined ? `${r.priority} ${r.value}` : r.value,
    ttl: r.ttl || "Auto",
    status: r.status,
  }));
}

/** Optional DMARC record, suggested with p=none first as Resend advises. */
export function dmarcSuggestion(rootDomain: string, reportAddress: string) {
  const root = rootDomain.split(".").slice(-2).join(".");
  return { host: `_dmarc.${root}`, type: "TXT", value: `v=DMARC1; p=none; rua=mailto:${reportAddress};` };
}

async function resend<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = env.resendApiKey();
  if (!key) throw new Error("RESEND_API_KEY is not set.");
  const res = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = `Resend returned ${res.status}`;
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      // keep status message
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export async function getSendingDomain(studioId: string) {
  return one<SendingDomain>(await db()`select * from sending_domains where studio_id = ${studioId}`);
}

/** POST /domains, then store the id and records (status not_started). */
export async function createDomain(studioId: string, domain: string) {
  const problem = domainProblem(domain);
  if (problem) throw new Error(problem);
  const existing = await getSendingDomain(studioId);
  if (existing) throw new Error("This studio already has a sending domain. Remove it first.");
  const created = await resend<ResendDomain>("/domains", { method: "POST", body: JSON.stringify({ name: domain.trim().toLowerCase() }) });
  const row = one<SendingDomain>(
    await db()`
      insert into sending_domains (studio_id, domain, resend_domain_id, status, records, region, last_checked_at)
      values (${studioId}, ${created.name}, ${created.id}, ${mapStatus(created.status)}, ${JSON.stringify(created.records ?? [])}::jsonb, ${created.region ?? null}, now())
      returning *`
  );
  log.info("sending_domain.created", { studio: studioId, domain: created.name });
  return row!;
}

/** POST /domains/{id}/verify: Resend re-checks DNS asynchronously; status goes to pending. */
export async function verifyDomain(studioId: string) {
  const row = await getSendingDomain(studioId);
  if (!row?.resend_domain_id) throw new Error("No sending domain to verify.");
  await resend(`/domains/${row.resend_domain_id}/verify`, { method: "POST" });
  return refreshDomain(studioId);
}

/** GET /domains/{id} and mirror status and records. */
export async function refreshDomain(studioId: string) {
  const row = await getSendingDomain(studioId);
  if (!row?.resend_domain_id) return null;
  const remote = await resend<ResendDomain>(`/domains/${row.resend_domain_id}`);
  return applyRemoteDomain(row.id, remote);
}

export async function applyRemoteDomain(rowId: string, remote: Pick<ResendDomain, "status" | "records">) {
  const status = mapStatus(remote.status);
  return one<SendingDomain>(
    await db()`
      update sending_domains set status = ${status}, records = ${JSON.stringify(remote.records ?? [])}::jsonb, last_checked_at = now(),
        verified_at = case when ${status} = 'verified' then coalesce(verified_at, now()) else verified_at end
      where id = ${rowId} returning *`
  );
}

/** For the domain.updated webhook: find our row by Resend's id. */
export async function applyDomainWebhook(resendDomainId: string, status: string, records: ResendRecord[] | undefined) {
  const row = one<SendingDomain>(await db()`select * from sending_domains where resend_domain_id = ${resendDomainId}`);
  if (!row) return null;
  return applyRemoteDomain(row.id, { status, records: records ?? row.records });
}

export async function setFromLocalPart(studioId: string, localPart: string) {
  const lp = localPart.trim().toLowerCase();
  if (!/^[a-z0-9._-]{1,64}$/.test(lp)) throw new Error("Use letters, numbers, dots, dashes or underscores.");
  return one<SendingDomain>(await db()`update sending_domains set from_local_part = ${lp} where studio_id = ${studioId} returning *`);
}

/** DELETE /domains/{id} then forget it; mail falls back to the platform sender. */
export async function removeDomain(studioId: string) {
  const row = await getSendingDomain(studioId);
  if (!row) return;
  if (row.resend_domain_id) {
    try {
      await resend(`/domains/${row.resend_domain_id}`, { method: "DELETE" });
    } catch (error) {
      log.warn("sending_domain.delete_failed", { studio: studioId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  await db()`delete from sending_domains where id = ${row.id}`;
}

/** Cron: re-check pending and temporarily failed domains (every 15 minutes for the first 72 hours, then daily). */
export async function recheckPendingDomains() {
  const pending = (await db()`
    select studio_id from sending_domains
    where status in ('pending', 'temporary_failure', 'not_started') and resend_domain_id is not null
      and (created_at > now() - interval '72 hours' or last_checked_at < now() - interval '1 day')`) as { studio_id: string }[];
  let changed = 0;
  for (const p of pending) {
    try {
      const before = await getSendingDomain(p.studio_id);
      const after = await refreshDomain(p.studio_id);
      if (before && after && before.status !== after.status) changed++;
    } catch (error) {
      log.warn("sending_domain.recheck_failed", { studio: p.studio_id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { checked: pending.length, changed };
}
