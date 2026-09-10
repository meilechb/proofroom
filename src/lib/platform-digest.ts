import "server-only";

import { db, one } from "@/lib/db";
import { platformMetrics } from "@/lib/admin";
import { sendPlatformEmail } from "@/lib/email";
import { formatMoney } from "@/lib/types";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

function bytesLabel(n: number) {
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(0)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

/** Daily digest to the platform alert address (plan 19.11). No-op without the address. */
export async function sendPlatformDigest() {
  const to = env.platformAlertEmail();
  if (!to) return { sent: false };
  const m = await platformMetrics();
  const day = one<{ n: number }>(await db()`select count(*)::int as n from studios where created_at >= now() - interval '1 day'`);
  const outliers = m.topStorage.slice(0, 5).map((s) => `  ${s.name}: ${bytesLabel(s.bytes)}`).join("\n");
  const attempted = m.emailsSent + m.emailsFailed;
  const failRate = attempted > 0 ? Math.round((m.emailsFailed / attempted) * 100) : 0;

  const text = [
    `Platform digest`,
    ``,
    `Signups (24h): ${day?.n ?? 0}`,
    `Active subscriptions: ${m.activeSubscriptions}  (MRR ${formatMoney(m.mrrCents)})`,
    `Trial conversion: ${m.conversion}%`,
    `Galleries live: ${m.galleriesLive}`,
    `Email (30d): ${m.emailsSent} sent, ${m.emailsFailed} failed (${failRate}%)`,
    `Referral rewards: ${m.rewardsGranted}`,
    `Storage total: ${bytesLabel(m.storageTotal)}`,
    ``,
    `Top storage:`,
    outliers || "  (none)",
  ].join("\n");

  const res = await sendPlatformEmail({ to, subject: `Platform digest — ${new Date().toLocaleDateString()}`, text, kind: "platform_digest" });
  if (!res.ok && !res.skipped) log.warn("platform_digest.failed", { error: res.error });
  return { sent: res.ok };
}

/** Sending-domain usage against the Resend plan limit (plan 16.18). */
export async function sendingDomainUsage() {
  const used = one<{ n: number }>(await db()`select count(*)::int as n from sending_domains where resend_domain_id is not null`);
  const limit = Number(env.resendDomainLimit() ?? 10) || 10;
  const count = used?.n ?? 0;
  return { used: count, limit, warn: count >= limit * 0.8 };
}
