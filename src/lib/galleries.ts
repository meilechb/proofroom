import "server-only";

import { db, one, rows } from "@/lib/db";
import { generateAccessCode, hashGallerySecret } from "@/lib/gallery-access";
import { gallerySlug } from "@/lib/slug";
import type { Gallery, GalleryKind } from "@/lib/types";
import { log } from "@/lib/logger";

/** Gallery lifecycle. Every function takes the studio id and scopes by it. */

export type GallerySettingsPatch = Partial<
  Pick<Gallery, "title" | "kind" | "welcome_message" | "allow_downloads" | "allow_comments" | "allow_client_upload" | "allow_sharing" | "watermark" | "download_size" | "pay_gated" | "sort_mode" | "expires_at" | "cover_photo_id" | "order_id">
> & { password?: string | null; download_pin?: string | null };

export async function createGallery(studioId: string, input: { clientId: string; orderId?: string | null; kind: GalleryKind; title: string; source?: "web" | "lightroom"; parentId?: string | null; subjectName?: string | null }) {
  const slug = await uniqueSlug(studioId, input.title);
  const defaults = input.kind === "final" ? { allow_downloads: true, allow_comments: false } : { allow_downloads: false, allow_comments: true };
  const gallery = one<Gallery>(
    await db()`
      insert into galleries (studio_id, client_id, order_id, kind, title, slug, access_code, source, parent_id, subject_name, allow_downloads, allow_comments)
      values (${studioId}, ${input.clientId}, ${input.orderId ?? null}, ${input.kind}, ${input.title.trim()}, ${slug}, ${generateAccessCode()}, ${input.source ?? "web"}, ${input.parentId ?? null}, ${input.subjectName ?? null}, ${defaults.allow_downloads}, ${defaults.allow_comments})
      returning *`
  );
  if (!gallery) throw new Error("Could not create the gallery.");
  return gallery;
}

async function uniqueSlug(studioId: string, title: string) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const slug = gallerySlug(title, generateAccessCode(4).toLowerCase());
    const taken = await db()`select 1 from galleries where studio_id = ${studioId} and slug = ${slug} limit 1`;
    if (taken.length === 0) return slug;
  }
  throw new Error("Could not find a free gallery address.");
}

export async function getGallery(studioId: string, id: string) {
  return one<Gallery>(await db()`select * from galleries where id = ${id} and studio_id = ${studioId}`);
}

export async function updateGallerySettings(studioId: string, id: string, patch: GallerySettingsPatch) {
  const current = await getGallery(studioId, id);
  if (!current) throw new Error("Not found");
  const passwordHash = patch.password === undefined ? current.password_hash : patch.password ? hashGallerySecret(patch.password) : null;
  const pinHash = patch.download_pin === undefined ? current.download_pin_hash : patch.download_pin ? hashGallerySecret(patch.download_pin) : null;
  return one<Gallery>(
    await db()`
      update galleries set
        title = ${patch.title ?? current.title},
        kind = ${patch.kind ?? current.kind},
        welcome_message = ${patch.welcome_message === undefined ? current.welcome_message : patch.welcome_message},
        allow_downloads = ${patch.allow_downloads ?? current.allow_downloads},
        allow_comments = ${patch.allow_comments ?? current.allow_comments},
        allow_client_upload = ${patch.allow_client_upload ?? current.allow_client_upload},
        allow_sharing = ${patch.allow_sharing ?? current.allow_sharing},
        watermark = ${patch.watermark ?? current.watermark},
        download_size = ${patch.download_size ?? current.download_size},
        pay_gated = ${patch.pay_gated ?? current.pay_gated},
        sort_mode = ${patch.sort_mode ?? current.sort_mode},
        expires_at = ${patch.expires_at === undefined ? current.expires_at : patch.expires_at},
        cover_photo_id = ${patch.cover_photo_id === undefined ? current.cover_photo_id : patch.cover_photo_id},
        order_id = ${patch.order_id === undefined ? current.order_id : patch.order_id},
        password_hash = ${passwordHash},
        download_pin_hash = ${pinHash}
      where id = ${id} and studio_id = ${studioId}
      returning *`
  );
}

export async function publishGallery(studioId: string, id: string) {
  return one<Gallery>(await db()`update galleries set status = 'published', published_at = coalesce(published_at, now()) where id = ${id} and studio_id = ${studioId} returning *`);
}

export async function unpublishGallery(studioId: string, id: string) {
  return one<Gallery>(await db()`update galleries set status = 'draft' where id = ${id} and studio_id = ${studioId} returning *`);
}

export async function archiveGallery(studioId: string, id: string) {
  return one<Gallery>(await db()`update galleries set status = 'archived' where id = ${id} and studio_id = ${studioId} returning *`);
}

export async function regenerateAccessCode(studioId: string, id: string) {
  return one<Gallery>(await db()`update galleries set access_code = ${generateAccessCode()} where id = ${id} and studio_id = ${studioId} returning *`);
}

/** Creates a finals gallery from the favorites of a proofs gallery; photos are copied by reference to the same blobs. */
export async function duplicateFinalsFromFavorites(studioId: string, proofGalleryId: string) {
  const proof = await getGallery(studioId, proofGalleryId);
  if (!proof) throw new Error("Not found");
  const finals = await createGallery(studioId, { clientId: proof.client_id, orderId: proof.order_id, kind: "final", title: `${proof.title.replace(/proofs?/i, "").trim() || proof.title} finals`, parentId: null });
  const copied = await db()`
    insert into photos (studio_id, gallery_id, original_url, preview_url, thumb_url, filename, width, height, size_bytes, sort_order, sha256, uploaded_by, captured_at)
    select p.studio_id, ${finals.id}, p.original_url, p.preview_url, p.thumb_url, p.filename, p.width, p.height, 0, p.sort_order, p.sha256, p.uploaded_by, p.captured_at
    from photos p join photo_selections s on s.photo_id = p.id and s.selected
    where p.gallery_id = ${proofGalleryId} and p.studio_id = ${studioId} and p.deleted_at is null
    returning id`;
  log.info("gallery.finals_from_favorites", { studio: studioId, from: proofGalleryId, to: finals.id, photos: copied.length });
  return { gallery: finals, copied: copied.length };
}

/** Cron: archive galleries past their expiry. Returns how many changed. */
export async function expireGalleries() {
  const changed = await db()`update galleries set status = 'archived' where status = 'published' and expires_at is not null and expires_at < now() returning id`;
  return changed.length;
}

export type GalleryCounts = { photos: number; favorites: number; unresolved_notes: number; views: number };

export async function galleryCounts(studioId: string, id: string): Promise<GalleryCounts> {
  const row = one<GalleryCounts>(
    await db()`
      select
        (select count(*)::int from photos where gallery_id = ${id} and deleted_at is null) as photos,
        (select count(*)::int from photo_selections where gallery_id = ${id} and selected) as favorites,
        (select count(*)::int from photo_comments where gallery_id = ${id} and author_role = 'client' and not resolved) as unresolved_notes,
        (select coalesce(sum(views), 0)::int from gallery_visits where gallery_id = ${id}) as views
      from galleries where id = ${id} and studio_id = ${studioId}`
  );
  return row ?? { photos: 0, favorites: 0, unresolved_notes: 0, views: 0 };
}

/** Team headshot day: a parent event gallery plus one child gallery per person, each with its own code (plan 3.53). */
export async function createTeamEvent(studioId: string, input: { clientId: string; orderId?: string | null; title: string; people: string[] }) {
  const parent = await createGallery(studioId, { clientId: input.clientId, orderId: input.orderId ?? null, kind: "proof", title: input.title });
  const children: Gallery[] = [];
  for (const raw of input.people) {
    const name = raw.trim();
    if (!name) continue;
    children.push(await createGallery(studioId, { clientId: input.clientId, orderId: input.orderId ?? null, kind: "proof", title: `${input.title}: ${name}`, parentId: parent.id, subjectName: name }));
  }
  return { parent, children };
}

export async function addPersonToEvent(studioId: string, parentId: string, name: string) {
  const parent = await getGallery(studioId, parentId);
  if (!parent) throw new Error("Not found");
  return createGallery(studioId, { clientId: parent.client_id, orderId: parent.order_id, kind: "proof", title: `${parent.title}: ${name.trim()}`, parentId: parent.id, subjectName: name.trim() });
}

export type EventPersonRow = Gallery & { photos: number; favorites: number; unresolved_notes: number; last_view: string | null };

export async function eventSummary(studioId: string, parentId: string) {
  return rows<EventPersonRow>(
    await db()`
      select g.*,
        (select count(*)::int from photos p where p.gallery_id = g.id and p.deleted_at is null) as photos,
        (select count(*)::int from photo_selections s where s.gallery_id = g.id and s.selected) as favorites,
        (select count(*)::int from photo_comments c where c.gallery_id = g.id and c.author_role = 'client' and not c.resolved) as unresolved_notes,
        (select max(v.last_seen) from gallery_visits v where v.gallery_id = g.id) as last_view
      from galleries g
      where g.parent_id = ${parentId} and g.studio_id = ${studioId}
      order by g.subject_name nulls last, g.created_at`
  );
}
