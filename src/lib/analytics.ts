import "server-only";

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
