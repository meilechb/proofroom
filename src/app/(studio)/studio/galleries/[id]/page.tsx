import { notFound } from "next/navigation";
import { requireStudioPage } from "@/lib/auth";
import { getGallery } from "@/lib/galleries";
import { listPhotos } from "@/lib/photos";
import { db, one, rows } from "@/lib/db";
import { galleryUrl } from "@/lib/tenant";
import { galleryKindLabels, type Client } from "@/lib/types";
import { PageHeader, Card, Badge, cx } from "@/components/ui";
import { CopyButton } from "@/components/forms/copy-button";
import { GalleryUploader } from "./gallery-uploader";
import { PhotoGrid } from "./photo-grid";
import { SettingsButton, SendGalleryButton } from "./gallery-panels";
import { createFinalsFromFavoritesAction, publishGalleryAction, regenerateCodeAction, archiveGalleryAction } from "./gallery-settings-actions";
import { resolveNoteAction } from "./photo-actions";

export async function generateMetadata({ params }: PageProps<"/studio/galleries/[id]">) {
  const { id } = await params;
  const ctx = await requireStudioPage();
  const g = await getGallery(ctx.studio.id, id);
  return { title: g?.title ?? "Gallery" };
}

export default async function GalleryDetailPage({ params }: PageProps<"/studio/galleries/[id]">) {
  const ctx = await requireStudioPage();
  const { id } = await params;
  const gallery = await getGallery(ctx.studio.id, id);
  if (!gallery) notFound();

  const [client, photos, favoriteRows, notes] = await Promise.all([
    one<Client>(await db()`select * from clients where id = ${gallery.client_id} and studio_id = ${ctx.studio.id}`),
    listPhotos(ctx.studio.id, id),
    rows<{ photo_id: string }>(await db()`select s.photo_id from photo_selections s join photos ph on ph.id = s.photo_id where ph.gallery_id = ${id}`),
    rows<{ id: string; body: string; filename: string; photo_id: string; resolved: boolean; created_at: string }>(
      await db()`select pc.id, pc.body, ph.filename, pc.photo_id, pc.resolved, pc.created_at from photo_comments pc join photos ph on ph.id = pc.photo_id where pc.gallery_id = ${id} and pc.author_role = 'client' order by pc.resolved, pc.created_at desc limit 100`
    ),
  ]);
  const favoriteIds = favoriteRows.map((f) => f.photo_id);
  const url = galleryUrl(ctx.studio, gallery.slug);
  const published = gallery.status === "published";
  const unresolved = notes.filter((n) => !n.resolved).length;
  const expiresInput = gallery.expires_at ? gallery.expires_at.slice(0, 10) : "";

  return (
    <>
      <PageHeader
        eyebrow="Galleries"
        title={gallery.title}
        description={[client?.name, galleryKindLabels[gallery.kind], `${photos.length} photos`, `${favoriteIds.length} favorited`].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={published ? "success" : "neutral"}>{published ? "Live" : "Draft"}</Badge>
            <SettingsButton gallery={gallery} expiresInput={expiresInput} />
            <form action={publishGalleryAction}>
              <input type="hidden" name="id" value={gallery.id} />
              <input type="hidden" name="publish" value={published ? "false" : "true"} />
              <button className={published ? "btn-secondary btn-sm" : "btn-primary btn-sm"}>{published ? "Unpublish" : "Publish"}</button>
            </form>
            {published ? <SendGalleryButton galleryId={gallery.id} clientEmail={client?.email ?? ""} kind={gallery.kind} /> : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6 min-w-0">
          <GalleryUploader galleryId={gallery.id} />
          {photos.length > 0 ? (
            <Card><PhotoGrid galleryId={gallery.id} photos={photos} coverId={gallery.cover_photo_id} favoriteIds={favoriteIds} /></Card>
          ) : (
            <p className="text-sm text-muted text-center py-8">No photos yet. Drop some above, or publish from Lightroom.</p>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-medium">Share</h2>
            {published ? (
              <>
                <p className="mt-2 text-xs text-muted">Client link</p>
                <div className="mt-1 flex items-center gap-2"><code className="flex-1 truncate rounded-md bg-surface-2 px-2 py-1.5 text-xs font-mono">{url}</code><CopyButton value={url} label="Copy" /></div>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-2">Publish to get a shareable link.</p>
            )}
            {gallery.access_code ? (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span>Access code <code className="ml-1 font-mono font-medium">{gallery.access_code}</code></span>
                <form action={regenerateCodeAction}><input type="hidden" name="id" value={gallery.id} /><button className="text-xs text-muted hover:text-ink">Regenerate</button></form>
              </div>
            ) : null}
            {published ? <a href={`${url}?preview=1`} target="_blank" rel="noopener" className="mt-3 inline-block text-sm underline">Preview as client</a> : null}
          </Card>

          {gallery.kind === "proof" ? (
            <Card>
              <h2 className="font-medium">Favorites</h2>
              <p className="mt-1 text-sm text-ink-2">{favoriteIds.length} of {photos.length} favorited.</p>
              {favoriteIds.length > 0 ? (
                <form action={createFinalsFromFavoritesAction} className="mt-3">
                  <input type="hidden" name="id" value={gallery.id} />
                  <button className="btn-secondary btn-sm w-full">Create finals gallery from favorites</button>
                </form>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Client notes</h2>
              {unresolved > 0 ? <Badge tone="warning">{unresolved} open</Badge> : null}
            </div>
            {notes.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No notes from the client yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className={cx("text-sm rounded-lg border border-line p-3", n.resolved && "opacity-60")}>
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
                      <span className="truncate">{n.filename}</span>
                      <form action={resolveNoteAction}>
                        <input type="hidden" name="galleryId" value={gallery.id} />
                        <input type="hidden" name="noteId" value={n.id} />
                        <input type="hidden" name="resolved" value={n.resolved ? "false" : "true"} />
                        <button className="hover:text-ink">{n.resolved ? "Reopen" : "Resolve"}</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <form action={archiveGalleryAction} className="text-right">
            <input type="hidden" name="id" value={gallery.id} />
            <button className="text-xs text-muted hover:text-danger">Archive gallery</button>
          </form>
        </div>
      </div>
    </>
  );
}
