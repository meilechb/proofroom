import "server-only";

import { db, one } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

/**
 * Custom domains for a studio's public site (plan 14.28-14.30). A studio points
 * its own domain (yourstudio.com) at our Vercel project; the proxy routes that
 * host to the studio's tenant tree once it verifies.
 *
 * We drive Vercel's REST API (docs read 2026-09-10):
 *   add    POST   /v10/projects/{project}/domains         -> { verified, verification }
 *   verify POST   /v9/projects/{project}/domains/{d}/verify -> { verified }
 *   get    GET    /v9/projects/{project}/domains/{d}       -> { verified, verification }
 *   config GET    /v6/domains/{d}/config?projectIdOrName=  -> { misconfigured, recommendedIPv4, recommendedCNAME, configuredBy }
 *   remove DELETE /v9/projects/{project}/domains/{d}
 *
 * `verified` is the ownership challenge (a TXT record when the apex is already on
 * another Vercel account); `misconfigured` is whether the A/CNAME records point
 * at Vercel yet. The domain only serves — and we only mark it active — when the
 * domain is verified AND not misconfigured.
 */

export type VercelVerification = { type: string; domain: string; value: string; reason: string };
export type VercelProjectDomain = { name: string; apexName: string; verified: boolean; verification?: VercelVerification[] };
export type VercelDomainConfig = {
  configuredBy: "A" | "CNAME" | "dns-01" | "http" | null;
  misconfigured: boolean;
  acceptedChallenges?: string[];
  recommendedIPv4?: { rank: number; value: string[] }[];
  recommendedCNAME?: { rank: number; value: string }[];
};

/** A row for the DNS table the studio must create at their registrar. */
export type DnsRecord = { purpose: string; type: "A" | "CNAME" | "TXT"; host: string; value: string };

/** How far along a custom domain is, from the studio's point of view. */
export type DomainState = "none" | "pending" | "active";

export type DomainStatus = {
  domain: string | null;
  state: DomainState;
  verifiedAt: string | null;
  /** True only when Vercel is wired up; otherwise the platform operator adds the domain by hand. */
  managed: boolean;
  /** Vercel says the domain is misconfigured (DNS not pointing to us yet). */
  misconfigured: boolean;
  /** Ownership challenge satisfied. */
  verified: boolean;
  records: DnsRecord[];
  /** A message when we could not reach Vercel. */
  error?: string;
};

/** Both the token and the project id are needed to drive the API. */
export function domainsManaged() {
  return Boolean(env.vercelApiToken() && env.vercelProjectId());
}

const PUBLIC_HOSTS = new Set(["localhost", "vercel.app", "vercel.com"]);

/** Validates the domain a studio typed. We steer them to their root domain. */
export function domainProblem(input: string): string | null {
  const d = input.trim().toLowerCase().replace(/\.$/, "");
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) return "Enter a domain like yourstudio.com.";
  if (PUBLIC_HOSTS.has(d) || [...PUBLIC_HOSTS].some((h) => d.endsWith(`.${h}`))) return "Use a domain you own.";
  const app = env.vercelProjectId() ? process.env.NEXT_PUBLIC_APP_DOMAIN?.split(":")[0].toLowerCase() : null;
  if (app && (d === app || d.endsWith(`.${app}`))) return "That is our domain. Use your own.";
  return null;
}

export function normalizeDomain(input: string) {
  return input.trim().toLowerCase().replace(/\.$/, "");
}

async function vercel<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = env.vercelApiToken();
  if (!token) throw new Error("VERCEL_API_TOKEN is not set.");
  const team = env.vercelTeamId();
  const url = new URL(`https://api.vercel.com${path}`);
  if (team) url.searchParams.set("teamId", team);
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 404) return null as T;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = `Vercel returned ${res.status}`;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // keep the status message
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

function project() {
  return encodeURIComponent(env.vercelProjectId() ?? "");
}

export async function addProjectDomain(domain: string) {
  return vercel<VercelProjectDomain | null>(`/v10/projects/${project()}/domains`, { method: "POST", body: JSON.stringify({ name: domain }) });
}

export async function verifyProjectDomain(domain: string) {
  return vercel<VercelProjectDomain | null>(`/v9/projects/${project()}/domains/${encodeURIComponent(domain)}/verify`, { method: "POST" });
}

export async function getProjectDomain(domain: string) {
  return vercel<VercelProjectDomain | null>(`/v9/projects/${project()}/domains/${encodeURIComponent(domain)}`);
}

export async function getDomainConfig(domain: string) {
  const p = env.vercelProjectId();
  const suffix = p ? `?projectIdOrName=${encodeURIComponent(p)}` : "";
  return vercel<VercelDomainConfig | null>(`/v6/domains/${encodeURIComponent(domain)}/config${suffix}`);
}

export async function removeProjectDomain(domain: string) {
  return vercel<unknown>(`/v9/projects/${project()}/domains/${encodeURIComponent(domain)}`, { method: "DELETE" });
}

/** The registrar records to show, chosen from Vercel's own recommendation. */
export function dnsRecords(remote: VercelProjectDomain, config: VercelDomainConfig | null): DnsRecord[] {
  const records: DnsRecord[] = [];
  const isApex = remote.name === remote.apexName;
  const host = isApex ? "@" : remote.name.slice(0, remote.name.length - remote.apexName.length - 1) || "@";
  if (isApex) {
    const ip = config?.recommendedIPv4?.slice().sort((a, b) => a.rank - b.rank)[0]?.value?.[0] ?? "76.76.21.21";
    records.push({ purpose: "Point the domain to us", type: "A", host, value: ip });
  } else {
    const cname = config?.recommendedCNAME?.slice().sort((a, b) => a.rank - b.rank)[0]?.value ?? "cname.vercel-dns.com";
    records.push({ purpose: "Point the domain to us", type: "CNAME", host, value: cname });
  }
  for (const v of remote.verification ?? []) {
    if (v.type.toUpperCase() === "TXT") records.push({ purpose: "Prove you own the domain", type: "TXT", host: v.domain, value: v.value });
  }
  return records;
}

/** Save a studio's chosen domain and register it with Vercel (plan 14.28). */
export async function setCustomDomain(studioId: string, input: string) {
  const domain = normalizeDomain(input);
  const problem = domainProblem(domain);
  if (problem) throw new Error(problem);
  const taken = one<{ id: string }>(await db()`select id from studios where lower(custom_domain) = ${domain} and id <> ${studioId} and deleted_at is null`);
  if (taken) throw new Error("That domain is already used by another studio.");
  if (domainsManaged()) {
    try {
      await addProjectDomain(domain);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // 409 already-assigned or a validation error: surface it rather than storing a domain we can't serve.
      throw new Error(message.includes("already") ? "That domain is assigned to another project. Remove it there first." : message);
    }
  }
  await db()`update studios set custom_domain = ${domain}, custom_domain_verified_at = null where id = ${studioId}`;
  log.info("custom_domain.set", { studio: studioId, domain });
  return domain;
}

/**
 * Re-check a studio's domain against Vercel and flip it active when it both
 * proves ownership and points at us (plan 14.29). Returns the current status.
 */
export async function checkCustomDomain(studioId: string): Promise<DomainStatus> {
  const studio = one<{ custom_domain: string | null; custom_domain_verified_at: string | null }>(
    await db()`select custom_domain, custom_domain_verified_at from studios where id = ${studioId}`
  );
  const domain = studio?.custom_domain ?? null;
  if (!domain) return { domain: null, state: "none", verifiedAt: null, managed: false, misconfigured: false, verified: false, records: [] };
  if (!domainsManaged()) {
    return { domain, state: studio?.custom_domain_verified_at ? "active" : "pending", verifiedAt: studio?.custom_domain_verified_at ?? null, managed: false, misconfigured: false, verified: Boolean(studio?.custom_domain_verified_at), records: [] };
  }
  try {
    let remote = await getProjectDomain(domain);
    if (!remote) remote = await addProjectDomain(domain);
    if (!remote) throw new Error("Vercel did not return the domain.");
    // If ownership is unverified, ask Vercel to re-check the TXT challenge now.
    if (!remote.verified) {
      const verified = await verifyProjectDomain(domain).catch(() => null);
      if (verified) remote = { ...remote, verified: verified.verified };
    }
    const config = await getDomainConfig(domain).catch(() => null);
    const misconfigured = config?.misconfigured ?? true;
    const active = remote.verified && !misconfigured;
    const verifiedAt = await applyDomainVerified(studioId, active);
    return { domain, state: active ? "active" : "pending", verifiedAt, managed: true, misconfigured, verified: remote.verified, records: dnsRecords(remote, config) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn("custom_domain.check_failed", { studio: studioId, domain, error: message });
    return { domain, state: studio?.custom_domain_verified_at ? "active" : "pending", verifiedAt: studio?.custom_domain_verified_at ?? null, managed: true, misconfigured: true, verified: Boolean(studio?.custom_domain_verified_at), records: [], error: message };
  }
}

/** Sets or clears custom_domain_verified_at, keeping the first verified time. */
async function applyDomainVerified(studioId: string, active: boolean) {
  const row = one<{ custom_domain_verified_at: string | null }>(
    await db()`
      update studios
      set custom_domain_verified_at = case when ${active} then coalesce(custom_domain_verified_at, now()) else null end
      where id = ${studioId}
      returning custom_domain_verified_at`
  );
  return row?.custom_domain_verified_at ?? null;
}

/** Remove the domain from Vercel and forget it (plan 14.30). */
export async function clearCustomDomain(studioId: string) {
  const studio = one<{ custom_domain: string | null }>(await db()`select custom_domain from studios where id = ${studioId}`);
  const domain = studio?.custom_domain;
  if (domain && domainsManaged()) {
    try {
      await removeProjectDomain(domain);
    } catch (error) {
      log.warn("custom_domain.remove_failed", { studio: studioId, domain, error: error instanceof Error ? error.message : String(error) });
    }
  }
  await db()`update studios set custom_domain = null, custom_domain_verified_at = null where id = ${studioId}`;
  log.info("custom_domain.cleared", { studio: studioId, domain });
}

/** Cron: re-check domains that are set but not yet active (plan 14.29). */
export async function recheckPendingCustomDomains() {
  if (!domainsManaged()) return { checked: 0, activated: 0 };
  const pending = (await db()`
    select id from studios
    where custom_domain is not null and custom_domain_verified_at is null and deleted_at is null
    limit 50`) as { id: string }[];
  let activated = 0;
  for (const s of pending) {
    try {
      const status = await checkCustomDomain(s.id);
      if (status.state === "active") activated++;
    } catch (error) {
      log.warn("custom_domain.recheck_failed", { studio: s.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { checked: pending.length, activated };
}
