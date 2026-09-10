"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button, cx } from "@/components/ui";
import type { PortfolioItem } from "@/lib/portfolio";
import { addToPortfolioAction, updatePortfolioItemAction, removePortfolioItemAction, reorderPortfolioAction, renameCategoryAction, listImportGalleriesAction, listGalleryPhotosAction, importPhotosAction } from "./actions";

type ImportGallery = { id: string; title: string; kind: string; client_name: string; photo_count: number };
type ImportPhoto = { id: string; thumb: string; filename: string };

type Available = { id: string; thumb: string; filename: string; alt: string };

/** Orders portfolio items and edits their category, caption, featured and publish flags (plan 15.5). */
export function PortfolioManager({ initialItems, available, categories }: { initialItems: PortfolioItem[]; available: Available[]; categories: string[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [dragId, setDragId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [, start] = useTransition();

  const commit = (fn: () => Promise<void>) => start(async () => { await fn(); router.refresh(); });

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = items.findIndex((i) => i.id === dragId);
    const to = items.findIndex((i) => i.id === targetId);
    if (from < 0 || to < 0) return;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    setDragId(null);
    commit(() => reorderPortfolioAction(next.map((i) => i.id)));
  };

  const patch = (id: string, p: Parameters<typeof updatePortfolioItemAction>[1]) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...p, caption: p.caption !== undefined ? p.caption : i.caption } : i)));
    commit(() => updatePortfolioItemAction(id, p));
  };

  const remove = (id: string) => {
    setItems((list) => list.filter((i) => i.id !== id));
    commit(() => removePortfolioItemAction(id));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-2">{items.length} photo{items.length === 1 ? "" : "s"}. Drag to reorder; the order is how they appear on your site.</p>
        <div className="flex gap-2">
          {categories.length ? <CategoryRenamer categories={categories} onRename={(from, to) => commit(() => renameCategoryAction(from, to))} /> : null}
          <Button size="sm" variant="secondary" onClick={() => setImporting(true)}>Import from gallery</Button>
          <Button size="sm" onClick={() => setAdding(true)} disabled={available.length === 0}>Add photos</Button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-2">No portfolio photos yet. Add some from your assets.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              draggable
              onDragStart={() => setDragId(item.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(item.id)}
              className={cx("flex gap-3 rounded-lg border bg-surface p-3", dragId === item.id ? "border-brand opacity-60" : "border-line", !item.is_published && "opacity-70")}
            >
              <div className="h-20 w-20 shrink-0 cursor-grab overflow-hidden rounded-md bg-surface-2" title="Drag to reorder">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumb} alt={item.alt || item.filename} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <input
                  defaultValue={item.caption ?? ""}
                  onBlur={(e) => { if ((e.target.value || null) !== item.caption) patch(item.id, { caption: e.target.value || null }); }}
                  placeholder="Caption (optional)"
                  className="w-full h-8 rounded border border-line-2 bg-surface px-2 text-sm"
                />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <input
                    defaultValue={item.category}
                    list="portfolio-categories"
                    onBlur={(e) => { if (e.target.value.trim() && e.target.value !== item.category) patch(item.id, { category: e.target.value }); }}
                    className="h-7 w-32 rounded border border-line-2 bg-surface px-2"
                    aria-label="Category"
                  />
                  <button type="button" onClick={() => patch(item.id, { is_featured: !item.is_featured })} className={cx("rounded-full border px-2 py-0.5", item.is_featured ? "border-brand text-brand" : "border-line text-muted")} aria-pressed={item.is_featured}>
                    {item.is_featured ? "★ Featured" : "☆ Feature"}
                  </button>
                  <button type="button" onClick={() => patch(item.id, { is_published: !item.is_published })} className={cx("rounded-full border px-2 py-0.5", item.is_published ? "border-success text-success" : "border-line text-muted")} aria-pressed={item.is_published}>
                    {item.is_published ? "Published" : "Hidden"}
                  </button>
                  <button type="button" onClick={() => remove(item.id)} className="ml-auto text-muted hover:text-danger">Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <datalist id="portfolio-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>

      <AddDialog
        open={adding}
        onClose={() => setAdding(false)}
        available={available}
        categories={categories}
        onAdd={(ids, category) => { setAdding(false); commit(() => addToPortfolioAction(ids, category)); }}
      />

      <ImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        categories={categories}
        onImported={() => { setImporting(false); router.refresh(); }}
      />
    </div>
  );
}

function ImportDialog({ open, onClose, categories, onImported }: { open: boolean; onClose: () => void; categories: string[]; onImported: () => void }) {
  const [galleries, setGalleries] = useState<ImportGallery[] | null>(null);
  const [openedOnce, setOpenedOnce] = useState(false);
  const [gallery, setGallery] = useState<ImportGallery | null>(null);
  const [photos, setPhotos] = useState<ImportPhoto[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState(categories[0] ?? "headshots");
  const [pending, start] = useTransition();

  // Load galleries the first time the dialog opens (guarded, not in an effect).
  if (open && !openedOnce) {
    setOpenedOnce(true);
    void listImportGalleriesAction().then(setGalleries);
  }
  if (!open && openedOnce) {
    // reset when closed so a re-open starts fresh
    setOpenedOnce(false);
    setGallery(null);
    setPhotos(null);
    setSelected(new Set());
  }

  const pickGallery = (g: ImportGallery) => {
    setGallery(g);
    setPhotos(null);
    setSelected(new Set());
    void listGalleryPhotosAction(g.id).then(setPhotos);
  };
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const doImport = () => start(async () => { await importPhotosAction([...selected], category || "headshots"); onImported(); });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={gallery ? `Import from ${gallery.title}` : "Import from a gallery"}
      footer={gallery ? <>
        <Button variant="secondary" size="sm" onClick={() => setGallery(null)}>Back</Button>
        <Button size="sm" disabled={selected.size === 0 || pending} onClick={doImport}>{pending ? "Importing…" : `Import ${selected.size || ""}`}</Button>
      </> : undefined}
    >
      {!gallery ? (
        galleries === null ? <p className="text-sm text-muted">Loading…</p> :
        galleries.length === 0 ? <p className="text-sm text-ink-2">No galleries are available. Only galleries whose client agreed to portfolio use in their agreement can be imported.</p> :
        <ul className="divide-y divide-line">
          {galleries.map((g) => (
            <li key={g.id}>
              <button type="button" onClick={() => pickGallery(g)} className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:text-brand">
                <span><span className="font-medium">{g.title}</span> <span className="text-muted">· {g.client_name}</span></span>
                <span className="text-muted text-xs">{g.photo_count} photo{g.photo_count === 1 ? "" : "s"} ›</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Category</span>
            <input value={category} onChange={(e) => setCategory(e.target.value)} list="portfolio-categories" className="h-9 flex-1 rounded-lg border border-line-2 bg-surface px-3 text-sm" placeholder="e.g. headshots" />
          </label>
          {photos === null ? <p className="text-sm text-muted">Loading photos…</p> :
          photos.length === 0 ? <p className="text-sm text-ink-2">This gallery has no photos.</p> :
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[45vh] overflow-y-auto">
            {photos.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => toggle(p.id)} className={cx("block w-full aspect-square overflow-hidden rounded-lg border-2", selected.has(p.id) ? "border-brand" : "border-transparent hover:border-line-2")} title={p.filename}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt={p.filename} loading="lazy" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>}
        </div>
      )}
    </Dialog>
  );
}

function CategoryRenamer({ categories, onRename }: { categories: string[]; onRename: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Categories</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Rename categories">
        <ul className="space-y-2">
          {categories.map((c) => (
            <li key={c} className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate text-sm">{c}</span>
              <input
                defaultValue={c}
                onBlur={(e) => { const to = e.target.value.trim(); if (to && to !== c) onRename(c, to); }}
                className="flex-1 h-9 rounded-lg border border-line-2 bg-surface px-3 text-sm"
                aria-label={`Rename ${c}`}
              />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Renaming updates every photo in that category.</p>
      </Dialog>
    </>
  );
}

function AddDialog({ open, onClose, available, categories, onAdd }: { open: boolean; onClose: () => void; available: Available[]; categories: string[]; onAdd: (ids: string[], category: string) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState(categories[0] ?? "headshots");
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add photos to portfolio"
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" disabled={selected.size === 0} onClick={() => { onAdd([...selected], category || "headshots"); setSelected(new Set()); }}>Add {selected.size || ""}</Button>
      </>}
    >
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Category</span>
          <input value={category} onChange={(e) => setCategory(e.target.value)} list="portfolio-categories" className="h-9 flex-1 rounded-lg border border-line-2 bg-surface px-3 text-sm" placeholder="e.g. headshots" />
        </label>
        {available.length === 0 ? (
          <p className="text-sm text-ink-2">Every asset is already in your portfolio. Upload more under Assets.</p>
        ) : (
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[45vh] overflow-y-auto">
            {available.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => toggle(a.id)} className={cx("block w-full aspect-square overflow-hidden rounded-lg border-2", selected.has(a.id) ? "border-brand" : "border-transparent hover:border-line-2")} title={a.filename}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.thumb} alt={a.alt || a.filename} loading="lazy" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
