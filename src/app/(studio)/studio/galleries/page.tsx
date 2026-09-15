import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { searchClients } from "@/lib/clients";
import { db, rows } from "@/lib/db";
import { galleryKindLabels, formatDate, type GalleryKind } from "@/lib/types";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { Tabs } from "@/components/ui/tabs";
import { SearchInput } from "@/components/ui/search-input";
import { NewGalleryButton } from "./new-gallery-dialog";

export const metadata = { title: "Galleries" };

type GalleryCard = { id: string; title: string; status: string; kind: GalleryKind; created_at: string; client_name: string; client_id: string; cover_thumb: string | null; photos: number; favorites: number; unresolved: number };

export default async function GalleriesPage({ searchParams }: PageProps<"/studio/galleries">) {
  const ctx = await requireStudioPage();
  const sp = await searchParams;
  const tab = (["all", "proof", "final", "draft", "published"].includes(String(sp.tab)) ? sp.tab : "all") as string;
  const q = typeof sp.q === "string" ? sp.q : undefined;

  const kindFilter = tab === "proof" || tab === "final" ? tab : null;
  const statusFilter = tab === "draft" || tab === "published" ? tab : null;

  const galleries = rows<GalleryCard>(
    await db()`
      select g.id, g.title, g.status, g.kind, g.created_at, c.name as client_name, c.id as client_id,
        (select ph.thumb_url from photos ph where ph.id = g.cover_photo_id) as cover_thumb,
        (select count(*)::int from photos ph where ph.gallery_id = g.id and ph.deleted_at is null) as photos,
        (select count(*)::int from photo_selections s join photos ph on ph.id = s.photo_id where ph.gallery_id = g.id) as favorites,
        (select count(*)::int from photo_comments pc where pc.gallery_id = g.id and pc.author_role = 'client' and not pc.resolved) as unresolved
      from galleries g join clients c on c.id = g.client_id
      where g.studio_id = ${ctx.studio.id} and g.parent_id is null
        and (${kindFilter}::text is null or g.kind = ${kindFilter})
        and (${statusFilter}::text is null or g.status = ${statusFilter})
        and g.status <> 'archived'
        and (${q ?? null}::text is null or g.title ilike ${q ? `%${q}%` : null} or c.name ilike ${q ? `%${q}%` : null})
      order by g.created_at desc
      limit 200`
  );

  const clients = (await searchClients(ctx.studio.id, { archived: false }, 500)).map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader
        title="Galleries"
        description="Proofing and final galleries. Publish from here or straight from Lightroom."
        actions={<NewGalleryButton clients={clients} presetClientId={typeof sp.client === "string" ? sp.client : undefined} presetOrderId={typeof sp.order === "string" ? sp.order : undefined} open={sp.new === "1"} />}
      />
      <Tabs items={[{ value: "all", label: "All" }, { value: "proof", label: "Proofs" }, { value: "final", label: "Finals" }, { value: "draft", label: "Drafts" }, { value: "published", label: "Live" }]} />
      <div className="mt-4"><SearchInput placeholder="Search by gallery or client" className="sm:max-w-xs" /></div>

      <div className="mt-4">
        {galleries.length === 0 ? (
          <EmptyState
            title={q ? "No galleries match" : "No galleries yet"}
            description={q ? "Try a different search." : "Create a gallery and upload proofs, or publish from Lightroom."}
            action={!q ? <NewGalleryButton clients={clients} /> : undefined}
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {galleries.map((g) => (
              <li key={g.id}>
                <Link href={`/studio/galleries/${g.id}`} className="card overflow-hidden block hover:border-line-2 transition-colors">
                  <div className="aspect-[4/3] bg-surface-2 relative">
                    {g.cover_thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.cover_thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted text-sm">{g.photos} photo{g.photos === 1 ? "" : "s"}</div>
                    )}
                    <div className="absolute top-2 left-2 flex gap-1">
                      <Badge tone={g.status === "published" ? "success" : "neutral"}>{g.status === "published" ? "Live" : "Draft"}</Badge>
                      {g.unresolved > 0 ? <Badge tone="warning">{g.unresolved} note{g.unresolved === 1 ? "" : "s"}</Badge> : null}
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="font-display text-lg leading-snug truncate">{g.title}</p>
                    <p className="text-xs text-muted mt-0.5">{g.client_name} · {galleryKindLabels[g.kind]} · {formatDate(g.created_at)}</p>
                    <p className="text-xs text-muted mt-1">{g.photos} photos · {g.favorites} favorited</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
