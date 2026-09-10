import "server-only";

import { db, one } from "@/lib/db";
import { disconnectAccount } from "@/lib/connect";
import { stripe } from "@/lib/stripe";
import { log } from "@/lib/logger";
import type { Studio } from "@/lib/types";

/**
 * Delete a studio (plan 17.7). Soft-deletes the row (so `deleted_at is null`
 * filters hide it everywhere), cancels the platform subscription, and
 * disconnects Stripe. A platform purge job removes the data later; the soft
 * delete stops all access immediately.
 */
export async function deleteStudio(studio: Pick<Studio, "id" | "stripe_account_id" | "stripe_connect_method">) {
  const row = one<{ stripe_subscription_id: string | null }>(await db()`select stripe_subscription_id from studios where id = ${studio.id}`);
  if (row?.stripe_subscription_id) {
    try {
      await stripe().subscriptions.cancel(row.stripe_subscription_id);
    } catch (error) {
      log.warn("studio_delete.subscription_cancel_failed", { studio: studio.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  try {
    await disconnectAccount(studio);
  } catch (error) {
    log.warn("studio_delete.disconnect_failed", { studio: studio.id, error: error instanceof Error ? error.message : String(error) });
  }
  await db()`update studios set deleted_at = now(), subscription_status = 'canceled' where id = ${studio.id}`;
  log.info("studio.deleted", { studio: studio.id });
}
