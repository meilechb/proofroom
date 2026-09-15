"use client";

import { useTransition } from "react";
import { ImagePicker, type PickerAsset } from "../../website/image-picker";
import { addCollectionAssetAction, removeCollectionItemAction } from "../actions";

export type CollectionItem = { item_id: string; asset_id: string; filename: string; thumb: string | null };

/** Add assets to a collection (via the shared image picker) and remove them. */
export function CollectionItems({ collectionId, items, assets }: { collectionId: string; items: CollectionItem[]; assets: PickerAsset[] }) {
  const [pending, start] = useTransition();
  const have = new Set(items.map((i) => i.asset_id));
  const available = assets.filter((a) => !have.has(a.id));

  const add = (id: string | null) => {
    if (!id) return;
    const fd = new FormData();
    fd.set("collectionId", collectionId);
    fd.set("assetId", id);
    start(() => {
      void addCollectionAssetAction(fd);
    });
  };

  return (
    <div className="space-y-3">
      {items.length ? (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {items.map((it) => (
            <div key={it.item_id} className="relative aspect-square overflow-hidden rounded-lg bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {it.thumb ? <img src={it.thumb} alt={it.filename} className="h-full w-full object-cover" /> : null}
              <form action={removeCollectionItemAction} className="absolute right-1 top-1">
                <input type="hidden" name="id" value={it.item_id} />
                <button aria-label={`Remove ${it.filename}`} className="grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white text-xs">×</button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">No images yet — add from your library or portfolio below.</p>
      )}
      <ImagePicker label="Add an image" value={null} assets={available} onChange={add} />
      {pending ? <p className="text-xs text-muted">Adding…</p> : null}
    </div>
  );
}
