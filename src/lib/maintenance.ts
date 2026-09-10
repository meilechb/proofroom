import "server-only";

import { db } from "@/lib/db";
import { listBlobs, deleteMany, storageConfigured, type Store } from "@/lib/storage";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

/**
 * Orphan blob cleanup (plan 15.8). Blobs older than 7 days with no database row
 * pointing at them are deleted. The age guard protects in-flight uploads; we only
 * ever delete from the store we scanned, matching the columns that can reference
 * it. Bounded per run so one cron tick stays quick and safe.
 */

const ORPHAN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PAGES = 8;
const MAX_DELETES = 300;

async function referencedUrls(store: Store): Promise<Set<string>> {
  const urls = new Set<string>();
  const add = (rowsResult: Array<Record<string, unknown>>, keys: string[]) => {
    for (const row of rowsResult) for (const k of keys) {
      const v = row[k];
      if (typeof v === "string" && v && !v.startsWith("pending:")) urls.add(v.split("?")[0]);
    }
  };
  if (store === "galleries") {
    add((await db()`select original_url, preview_url, thumb_url from photos`) as Array<Record<string, unknown>>, ["original_url", "preview_url", "thumb_url"]);
  } else {
    add((await db()`select url, web_url, thumb_url from assets`) as Array<Record<string, unknown>>, ["url", "web_url", "thumb_url"]);
    add((await db()`select url from documents`) as Array<Record<string, unknown>>, ["url"]);
  }
  return urls;
}

async function cleanupStore(store: Store) {
  const referenced = await referencedUrls(store);
  const cutoff = Date.now() - ORPHAN_AGE_MS;
  const orphans: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { blobs, cursor: next, hasMore } = await listBlobs(store, cursor);
    for (const b of blobs) {
      if (b.uploadedAt.getTime() >= cutoff) continue;
      if (referenced.has(b.url.split("?")[0])) continue;
      orphans.push(b.url);
      if (orphans.length >= MAX_DELETES) break;
    }
    if (orphans.length >= MAX_DELETES || !hasMore || !next) break;
    cursor = next;
  }
  if (orphans.length) {
    await deleteMany(store, orphans);
    log.info("orphan_cleanup.deleted", { store, count: orphans.length });
  }
  return orphans.length;
}

export async function cleanupOrphanBlobs() {
  if (!storageConfigured()) return { galleries: 0, assets: 0 };
  const galleries = await cleanupStore("galleries").catch((e) => { log.warn("orphan_cleanup.failed", { store: "galleries", error: e instanceof Error ? e.message : String(e) }); return 0; });
  const assets = env.assetsBlobToken()
    ? await cleanupStore("assets").catch((e) => { log.warn("orphan_cleanup.failed", { store: "assets", error: e instanceof Error ? e.message : String(e) }); return 0; })
    : 0;
  return { galleries, assets };
}
