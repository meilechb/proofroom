import "server-only";

import { db, one } from "@/lib/db";
import type { Entitlements } from "@/lib/plans";
import { withinLimit } from "@/lib/plans";

/** Per-studio usage counters used for plan enforcement and billing meters. */

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

/** Refreshes the cached storage_bytes on the studio row (called after uploads and deletes). */
export async function refreshStorage(studioId: string) {
  const usage = await getUsage(studioId);
  await db()`update studios set storage_bytes = ${usage.storageBytes}, updated_at = now() where id = ${studioId}`;
  return usage.storageBytes;
}

export class LimitError extends Error {
  constructor(message: string, public reason: "storage" | "galleries" | "members" | "tokens" | "feature" | "delinquent") {
    super(message);
  }
}

export function assertStorage(ent: Entitlements, usedBytes: number, incomingBytes: number) {
  if (ent.delinquent) throw new LimitError("Your subscription payment failed. Update your card in Billing to keep uploading.", "delinquent");
  if (usedBytes + incomingBytes > ent.limits.storageBytes) {
    throw new LimitError("You have reached the storage included in your plan. Upgrade in Billing or delete old galleries.", "storage");
  }
}

export function assertCanPublishGallery(ent: Entitlements, activeGalleries: number) {
  if (!withinLimit(activeGalleries, ent.limits.activeGalleries)) {
    throw new LimitError(`Your plan allows ${ent.limits.activeGalleries} live galleries. Close one or upgrade in Billing.`, "galleries");
  }
}

export function assertCanInvite(ent: Entitlements, members: number) {
  if (!withinLimit(members, ent.limits.members)) {
    throw new LimitError(`Your plan includes ${ent.limits.members} team member${ent.limits.members === 1 ? "" : "s"}. Upgrade in Billing to add more.`, "members");
  }
}

export function assertCanCreateToken(ent: Entitlements, tokens: number) {
  if (!withinLimit(tokens, ent.limits.apiTokens)) {
    throw new LimitError("Your plan's Lightroom token limit is reached. Revoke one or upgrade.", "tokens");
  }
}

export function assertFeature(ent: Entitlements, feature: keyof Entitlements["features"], label: string) {
  if (!ent.features[feature]) throw new LimitError(`${label} is available on higher plans. Upgrade in Billing.`, "feature");
}
