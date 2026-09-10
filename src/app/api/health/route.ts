import { NextResponse } from "next/server";
import { db, dbConfigured } from "@/lib/db";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { blobToken } from "@/lib/storage";

/**
 * GET /api/health (plan 19.10). Reports whether each dependency is configured
 * and reachable. Results are cached in the instance for 60 seconds so the
 * status link in the footer cannot be used to hammer providers.
 */

type Check = { configured: boolean; ok: boolean; ms?: number; error?: string };
type Report = { status: "ok" | "degraded"; checkedAt: string; checks: Record<"database" | "storage" | "stripe" | "email", Check> };

let cache: { report: Report; until: number } | null = null;

async function timed(configured: boolean, run: () => Promise<unknown>): Promise<Check> {
  if (!configured) return { configured: false, ok: false, error: "not configured" };
  const started = Date.now();
  try {
    await Promise.race([run(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout after 5s")), 5000))]);
    return { configured: true, ok: true, ms: Date.now() - started };
  } catch (error) {
    return { configured: true, ok: false, ms: Date.now() - started, error: error instanceof Error ? error.message : "failed" };
  }
}

async function build(): Promise<Report> {
  const [database, storage, stripeCheck, email] = await Promise.all([
    timed(dbConfigured(), () => db()`select 1`),
    timed(Boolean(env.blobToken()), async () => {
      const { list } = await import("@vercel/blob");
      await list({ token: blobToken("galleries"), limit: 1 });
    }),
    timed(Boolean(env.stripeSecretKey()), () => stripe().balance.retrieve()),
    timed(Boolean(env.resendApiKey()), async () => {
      const res = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${env.resendApiKey()}` } });
      if (!res.ok) throw new Error(`resend ${res.status}`);
    }),
  ]);
  const checks = { database, storage, stripe: stripeCheck, email };
  // Only configured dependencies count against status: a preview without Stripe is not "degraded".
  const degraded = Object.values(checks).some((c) => c.configured && !c.ok);
  return { status: degraded ? "degraded" : "ok", checkedAt: new Date().toISOString(), checks };
}

export async function GET() {
  if (!cache || cache.until < Date.now()) {
    cache = { report: await build(), until: Date.now() + 60_000 };
  }
  return NextResponse.json(cache.report, { status: cache.report.status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
