import "server-only";

import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

/** Vercel Cron sends CRON_SECRET as "Authorization: Bearer <secret>" (vercel.com/docs/cron-jobs/manage-cron-jobs). */
export function cronAuthorized(request: NextRequest) {
  const secret = env.cronSecret();
  if (!secret) return process.env.NODE_ENV !== "production"; // local runs without a secret
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Runs each job, records timing and errors, never lets one job stop the others. */
export async function runJobs(name: string, jobs: Record<string, () => Promise<unknown>>) {
  const results: Record<string, { ok: boolean; ms: number; result?: unknown; error?: string }> = {};
  for (const [job, fn] of Object.entries(jobs)) {
    const started = Date.now();
    try {
      const result = await fn();
      results[job] = { ok: true, ms: Date.now() - started, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results[job] = { ok: false, ms: Date.now() - started, error: message };
      log.error("cron.job_failed", { cron: name, job, error: message });
    }
  }
  log.info("cron.finished", { cron: name, jobs: Object.keys(jobs).length, failed: Object.values(results).filter((r) => !r.ok).length });
  return results;
}
