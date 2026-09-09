import "server-only";

import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { db, dbConfigured } from "@/lib/db";

export type AnalyticsEvent = "site_view" | "gallery_view" | "photo_view" | "download" | "favorite";

/** Increments a daily counter. Cheap upsert; never throws. */
export async function track(studioId: string, event: AnalyticsEvent, target: string) {
  if (!dbConfigured()) return;
  try {
    await db()`
      insert into analytics_daily (studio_id, day, event, target, count)
      values (${studioId}, current_date, ${event}, ${target.slice(0, 200)}, 1)
      on conflict (studio_id, day, event, target) do update set count = analytics_daily.count + 1`;
  } catch (error) {
    console.error("analytics upsert failed", error);
  }
}

export async function summary(studioId: string, event: AnalyticsEvent, target: string | null, days = 30) {
  const result = target
    ? await db()`select day::text, sum(count)::int as count from analytics_daily where studio_id = ${studioId} and event = ${event} and target = ${target} and day >= current_date - ${days}::int group by day order by day`
    : await db()`select day::text, sum(count)::int as count from analytics_daily where studio_id = ${studioId} and event = ${event} and day >= current_date - ${days}::int group by day order by day`;
  return result as Array<{ day: string; count: number }>;
}

export async function totals(studioId: string, days = 30) {
  const result = await db()`
    select event, sum(count)::int as count from analytics_daily
    where studio_id = ${studioId} and day >= current_date - ${days}::int group by event`;
  const out: Record<string, number> = {};
  for (const r of result as Array<{ event: string; count: number }>) out[r.event] = r.count;
  return out;
}


/** Same person, same day → same hash; no ip or user agent is stored (plan 3.56). */
export function visitorHash(ip: string, userAgent: string, day = new Date().toISOString().slice(0, 10)) {
  return createHash("sha256").update(`${env.appSecret() ?? "dev"}|${day}|${ip}|${userAgent}`).digest("hex").slice(0, 32);
}

export async function recordGalleryVisit(galleryId: string, visitor: string) {
  if (!dbConfigured()) return;
  try {
    await db()`
      insert into gallery_visits (gallery_id, visitor_hash) values (${galleryId}, ${visitor})
      on conflict (gallery_id, visitor_hash) do update set views = gallery_visits.views + 1, last_seen = now()`;
    await db()`update galleries set view_count = view_count + 1 where id = ${galleryId}`;
  } catch (error) {
    console.error("gallery visit upsert failed", error);
  }
}

export async function recordDownload(galleryId: string, photoId: string | null, kind: "single" | "selection" | "zip", size: "web" | "full", visitor: string | null) {
  if (!dbConfigured()) return;
  try {
    await db()`insert into gallery_downloads (gallery_id, photo_id, kind, size, visitor_hash) values (${galleryId}, ${photoId}, ${kind}, ${size}, ${visitor})`;
    if (visitor) await db()`update gallery_visits set downloads = downloads + 1 where gallery_id = ${galleryId} and visitor_hash = ${visitor}`;
  } catch (error) {
    console.error("download insert failed", error);
  }
}
