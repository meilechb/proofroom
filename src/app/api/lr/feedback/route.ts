import { withApi, ApiError } from "@/lib/lr-api";
import { db, rows, isUuid } from "@/lib/db";

/**
 * POST /api/lr/feedback { photo_ids: [...] } — favorites and comments for a batch
 * of published photos, keyed by photo id (plan 18.8, 18.15). This is what the
 * plugin's Comments-panel sync calls; the per-gallery GET variant also exists.
 */
export const POST = withApi(async ({ studio, body }) => {
  const raw = (body as { photo_ids?: unknown } | null)?.photo_ids;
  const ids = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && isUuid(x)).slice(0, 500) : [];
  if (ids.length === 0) return { comments: {}, favorites: [] };
  if (ids.length > 500) throw new ApiError(400, "invalid", "Too many photo ids.");

  const favs = rows<{ photo_id: string }>(
    await db()`select s.photo_id from photo_selections s join photos p on p.id = s.photo_id where p.studio_id = ${studio.id} and s.selected and s.photo_id = any(${ids}::uuid[])`
  );
  const comm = rows<{ photo_id: string; id: string; author_name: string; author_role: string; body: string; resolved: boolean; created_at: string }>(
    await db()`
      select c.photo_id, c.id::text, c.author_name, c.author_role, c.body, c.resolved, c.created_at::text
      from photo_comments c join photos p on p.id = c.photo_id
      where p.studio_id = ${studio.id} and c.photo_id = any(${ids}::uuid[])
      order by c.created_at`
  );

  const comments: Record<string, unknown[]> = {};
  for (const c of await comm) {
    (comments[c.photo_id] ??= []).push({ id: c.id, author_name: c.author_name, author_role: c.author_role, body: c.body, resolved: c.resolved, created_at: c.created_at });
  }
  return { comments, favorites: (await favs).map((f) => f.photo_id) };
}, { write: false });
