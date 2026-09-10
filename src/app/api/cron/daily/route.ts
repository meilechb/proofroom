import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized, runJobs } from "@/lib/cron";
import { markExpiredTrialsReadOnly } from "@/lib/billing";
import { expireGalleries } from "@/lib/galleries";
import { purgeDeleted, dropStalePending } from "@/lib/photos";
import { recheckPendingDomains } from "@/lib/sending-domains";
import { applyDueRewards } from "@/lib/referrals-server";
import { cleanupImports } from "@/lib/imports";
import { cleanupOrphanBlobs } from "@/lib/maintenance";
import { db } from "@/lib/db";
import { sendTrialEndedEmail, sendTrialEndingEmail } from "@/lib/emails/billing";

export const maxDuration = 300;

/** Once a day at 06:00 UTC (vercel.json). Every job is idempotent (plan 6.7). */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  const results = await runJobs("daily", {
    trialReminders,
    markReadOnly: async () => {
      const count = await markExpiredTrialsReadOnly();
      if (count > 0) await notifyTrialEnded();
      return count;
    },
    expireGalleries,
    purgeDeletedPhotos: () => purgeDeleted(30),
    dropStalePendingUploads: () => dropStalePending(24),
    recheckSendingDomains: recheckPendingDomains,
    applyQueuedReferralRewards: applyDueRewards,
    cleanupImports,
    cleanupOrphanBlobs,
    refreshStorageCounters,
  });
  return NextResponse.json(results);
}

/** 3 days and 1 day before a trial ends, once each (recorded in automation_sends with a null-studio-safe key). */
async function trialReminders() {
  const due = (await db()`
    select s.id, s.name, u.email, ceil(extract(epoch from (s.trial_ends_at - now())) / 86400)::int as days_left
    from studios s join memberships m on m.studio_id = s.id and m.role = 'owner' join users u on u.id = m.user_id
    where s.deleted_at is null and s.subscription_status is null and s.plan_override is null
      and s.trial_ends_at between now() and now() + interval '3 days'`) as { id: string; name: string; email: string; days_left: number }[];
  let sent = 0;
  for (const s of due) {
    const bucket = s.days_left <= 1 ? "trial_1d" : "trial_3d";
    const marked = await db()`insert into automation_sends (studio_id, rule, target) values (${s.id}, ${bucket}, ${s.id}) on conflict do nothing returning rule`;
    if (marked.length === 0) continue;
    await sendTrialEndingEmail(s.email, s.name, Math.max(1, s.days_left));
    sent++;
  }
  return sent;
}

async function notifyTrialEnded() {
  const rows = (await db()`
    select s.id, s.name, u.email from studios s join memberships m on m.studio_id = s.id and m.role = 'owner' join users u on u.id = m.user_id
    where s.read_only_since > now() - interval '1 day' and s.subscription_status is null`) as { id: string; name: string; email: string }[];
  for (const s of rows) {
    const marked = await db()`insert into automation_sends (studio_id, rule, target) values (${s.id}, 'trial_ended', ${s.id}) on conflict do nothing returning rule`;
    if (marked.length > 0) await sendTrialEndedEmail(s.email, s.name);
  }
}

async function refreshStorageCounters() {
  const updated = await db()`
    update studios s set storage_bytes = coalesce((select sum(size_bytes) from photos where studio_id = s.id and deleted_at is null), 0)
      + coalesce((select sum(size_bytes) from assets where studio_id = s.id and deleted_at is null), 0)
      + coalesce((select sum(size_bytes) from documents where studio_id = s.id), 0)
    where s.deleted_at is null returning id`;
  return updated.length;
}
