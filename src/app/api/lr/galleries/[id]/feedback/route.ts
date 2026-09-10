import { withApi, ApiError } from "@/lib/lr-api";
import { db, one, rows, isUuid } from "@/lib/db";

/** GET /api/lr/galleries/[id]/feedback?since= — favorites and comments (plan 18.8). */
export const GET = withApi(async ({ studio, request, params }) => {
  const id = params.id;
  if (!isUuid(id)) throw new ApiError(400, "invalid", "Bad gallery id.");
  const gallery = one<{ id: string }>(await db()`select id from galleries where id = ${id} and studio_id = ${studio.id}`);
  if (!gallery) throw new ApiError(404, "not_found", "Gallery not found.");

  const sinceRaw = request.nextUrl.searchParams.get("since");
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? new Date(sinceRaw).toISOString() : null;

  const favorites = rows<{ photo_id: string; lr_photo_id: string | null; filename: string; at: string }>(
    await db()`
      select s.photo_id, p.lr_photo_id, p.filename, s.created_at::text as at
      from photo_selections s join photos p on p.id = s.photo_id
      where s.gallery_id = ${id} and s.selected and (${since}::timestamptz is null or s.created_at >= ${since}::timestamptz)`
  );
  const comments = rows<{ photo_id: string; lr_photo_id: string | null; filename: string; author_name: string; body: string; at: string }>(
    await db()`
      select c.photo_id, p.lr_photo_id, p.filename, c.author_name, c.body, c.created_at::text as at
      from photo_comments c join photos p on p.id = c.photo_id
      where c.gallery_id = ${id} and c.author_role = 'client' and (${since}::timestamptz is null or c.created_at >= ${since}::timestamptz)
      order by c.created_at`
  );

  return {
    favorites: (await favorites).map((f) => ({ photoId: f.photo_id, lrId: f.lr_photo_id, filename: f.filename, at: f.at })),
    comments: (await comments).map((c) => ({ photoId: c.photo_id, lrId: c.lr_photo_id, filename: c.filename, name: c.author_name, body: c.body, at: c.at })),
    now: new Date().toISOString(),
  };
});
