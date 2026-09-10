"use client";

import { useState } from "react";
import type { Photo } from "@/lib/types";
import { cx } from "@/components/ui";
import { deletePhotosAction, setCoverAction } from "./photo-actions";

/** Selectable photo grid with delete and set-cover (plan 12.13, 12.14). */
export function PhotoGrid({ galleryId, photos, coverId, favoriteIds }: { galleryId: string; photos: Photo[]; coverId: string | null; favoriteIds: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const favorites = new Set(favoriteIds);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectedIds = [...selected];

  return (
    <div>
      <div className="flex items-center justify-between mb-3 min-h-8">
        <p className="text-sm text-muted">{photos.length} photo{photos.length === 1 ? "" : "s"}{selected.size ? ` · ${selected.size} selected` : ""}</p>
        {selected.size > 0 ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSelected(new Set())} className="btn-ghost btn-sm">Clear</button>
            {selected.size === 1 ? (
              <form action={setCoverAction}>
                <input type="hidden" name="galleryId" value={galleryId} />
                <input type="hidden" name="photoId" value={selectedIds[0]} />
                <button className="btn-secondary btn-sm">Set as cover</button>
              </form>
            ) : null}
            <form action={deletePhotosAction} onSubmit={() => setSelected(new Set())}>
              <input type="hidden" name="galleryId" value={galleryId} />
              <input type="hidden" name="ids" value={selectedIds.join(",")} />
              <button className="btn-danger btn-sm">Delete {selected.size}</button>
            </form>
          </div>
        ) : null}
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {photos.map((p) => {
          const isSelected = selected.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggle(p.id)}
                aria-pressed={isSelected}
                className={cx("relative block w-full aspect-square overflow-hidden rounded-lg border-2", isSelected ? "border-accent" : "border-transparent hover:border-line-2")}
              >
                {p.thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumb_url} alt={p.filename} loading="lazy" className="h-full w-full object-cover bg-surface-2" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-surface-2 text-[10px] text-muted">processing…</span>
                )}
                {isSelected ? <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-accent text-white text-xs flex items-center justify-center">✓</span> : null}
                {favorites.has(p.id) ? <span className="absolute top-1 right-1 text-white drop-shadow" aria-label="Favorited">♥</span> : null}
                {coverId === p.id ? <span className="absolute bottom-1 left-1 badge-brand">Cover</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
