import "server-only";

import { db, one } from "@/lib/db";
import { billingState, entitlements, formatBytes, type StudioBillingFields } from "@/lib/plans";

/**
 * Per-studio usage counters. Shown on the billing and assets pages and to the
 * platform admin. Nothing is capped: there is one plan with everything
 * included. Platform admin sees studios above USAGE_ATTENTION_BYTES.
 */

export const USAGE_ATTENTION_BYTES = 500 * 1024 ** 3;

export type Usage = { storageBytes: number; activeGalleries: number; members: number; apiTokens: number };

export async function getUsage(studioId: string): Promise<Usage> {
  const row = one<{ storage: string; galleries: number; members: number; tokens: number }>(
    await db()`
      select
        (select coalesce(sum(size_bytes), 0) from photos where studio_id = ${studioId})
          + (select coalesce(sum(size_bytes), 0) from assets where studio_id = ${studioId})
          + (select coalesce(sum(size_bytes), 0) from documents where studio_id = ${studioId}) as storage,
        (select count(*)::int from galleries where studio_id = ${studioId} and status = 'published') as galleries,
        (select count(*)::int from memberships where studio_id = ${studioId}) as members,
        (select count(*)::int from api_tokens where studio_id = ${studioId} and revoked_at is null) as tokens`
  );
  return {
    storageBytes: Number(row?.storage ?? 0),
    activeGalleries: row?.galleries ?? 0,
    members: row?.members ?? 0,
    apiTokens: row?.tokens ?? 0,
  };
}

/**
 * Whether a studio is at or over its plan's storage cap. Uses the cached
 * storage_bytes column (refreshStorage corrects any drift daily) and the
 * studio's effective plan. Free is capped; Pro is uncapped (capBytes null).
 */
export async function overStorageCap(studioId: string): Promise<{ over: boolean; capBytes: number | null; usedBytes: number }> {
  const row = one<StudioBillingFields & { storage_bytes: string }>(
    await db()`
      select plan, trial_ends_at::text, subscription_status, current_period_end::text, cancel_at_period_end,
             suspended_at::text, read_only_since::text, grace_ends_at::text, plan_override, storage_bytes
      from studios where id = ${studioId}`
  );
  if (!row) return { over: false, capBytes: null, usedBytes: 0 };
  const capBytes = entitlements(billingState(row).effectivePlan).storageBytes;
  const usedBytes = Number(row.storage_bytes ?? 0);
  return { over: capBytes !== null && usedBytes >= capBytes, capBytes, usedBytes };
}

/** Throws a clear upgrade message when a studio is at or over its storage cap. Call before any upload. */
export async function assertUnderStorageCap(studioId: string) {
  const { over, capBytes } = await overStorageCap(studioId);
  if (over) {
    throw new Error(`You've reached your ${formatBytes(capBytes ?? 0)} storage limit on the Free plan. Upgrade to Pro for uncapped storage, or remove some photos to free up space.`);
  }
}

/** Refreshes the cached storage_bytes on the studio row (called after uploads and deletes). */
export async function refreshStorage(studioId: string) {
  const usage = await getUsage(studioId);
  await db()`update studios set storage_bytes = ${usage.storageBytes}, updated_at = now() where id = ${studioId}`;
  return usage.storageBytes;
}

/** Adjust the cached counter immediately after an upload or delete; refreshStorage() corrects drift daily. */
export async function addBytes(studioId: string, bytes: number) {
  if (!bytes) return;
  await db()`update studios set storage_bytes = greatest(0, storage_bytes + ${bytes}) where id = ${studioId}`;
}

export async function subtractBytes(studioId: string, bytes: number) {
  if (!bytes) return;
  await db()`update studios set storage_bytes = greatest(0, storage_bytes - ${bytes}) where id = ${studioId}`;
}
