import { requireStudioPage } from "@/lib/auth";
import { listCollectionAssets, listCollections } from "@/lib/store";
import { isReady, listAssets } from "@/lib/assets";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { UpgradeLock } from "@/components/studio/upgrade-lock";
import type { PickerAsset } from "../../website/image-picker";
import { CollectionDialog } from "./collection-dialog";
import { CollectionItems, type CollectionItem } from "./collection-items";
import { deleteCollectionAction } from "../actions";

export const metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const ctx = await requireStudioPage("admin");
  if (!ctx.entitlements.store) {
    return (
      <>
        <PageHeader title="Collections" description="Curate a set of images to sell as one." />
        <UpgradeLock title="Online store">Group images from your portfolio and library into a collection buyers can unlock in one purchase.</UpgradeLock>
      </>
    );
  }

  const collections = await listCollections(ctx.studio.id);
  const itemsByCollection = new Map<string, CollectionItem[]>(
    await Promise.all(
      collections.map(async (c) => [
        c.id,
        (await listCollectionAssets(ctx.studio.id, c.id)).map((a) => ({ item_id: a.item_id, asset_id: a.asset_id, filename: a.filename, thumb: a.thumb_url ?? a.web_url ?? a.url })),
      ] as const)
    )
  );
  const pickerAssets: PickerAsset[] = (await listAssets(ctx.studio.id)).filter(isReady).map((a) => ({ id: a.id, thumb: a.thumb_url ?? a.web_url ?? a.url, filename: a.filename, alt: a.alt }));

  return (
    <>
      <PageHeader
        title="Collections"
        description="Group images into a set. Sell one with a “collection unlock” product."
        actions={
          <div className="flex gap-2">
            <ButtonLink href="/studio/store" variant="secondary">Products</ButtonLink>
            <CollectionDialog trigger="add" assets={pickerAssets} />
          </div>
        }
      />
      {collections.length === 0 ? (
        <EmptyState
          title="No collections yet"
          description="Create a collection, add images from your library or portfolio, then sell it as a collection-unlock product."
          action={<CollectionDialog trigger="add" assets={pickerAssets} />}
        />
      ) : (
        <ul className="space-y-4">
          {collections.map((c) => {
            const items = itemsByCollection.get(c.id) ?? [];
            return (
              <li key={c.id} className="card card-pad">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium">{c.title}</h2>
                      {c.visibility !== "public" ? <Badge>{c.visibility}</Badge> : null}
                      <span className="text-xs text-muted">{items.length} image{items.length === 1 ? "" : "s"}</span>
                    </div>
                    {c.description ? <p className="mt-0.5 text-sm text-ink-2 line-clamp-1">{c.description}</p> : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <CollectionDialog collection={c} trigger="edit" assets={pickerAssets} />
                    <form action={deleteCollectionAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="text-xs text-muted hover:text-danger">Delete</button>
                    </form>
                  </div>
                </div>
                <div className="mt-4">
                  <CollectionItems collectionId={c.id} items={items} assets={pickerAssets} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
