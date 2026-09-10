"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/dialog";
import { Button, cx } from "@/components/ui";
import { ASSET_FOLDERS, formatBytes, type Asset } from "@/lib/assets-shared";
import { updateAssetAction, deleteAssetAction, bulkAssetsAction, assetUsesAction } from "./actions";


/** Selectable grid with a detail drawer and a bulk action bar (plan 15.1-15.3). */
export function AssetsBrowser({ assets }: { assets: Asset[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<Asset | null>(null);
  const [, startTransition] = useTransition();

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clear = () => setSelected(new Set());

  const runBulk = (op: "delete" | "folder", folder?: string) => {
    const fd = new FormData();
    fd.set("ids", [...selected].join(","));
    fd.set("op", op);
    if (folder !== undefined) fd.set("folder", folder);
    startTransition(async () => { await bulkAssetsAction(fd); clear(); router.refresh(); });
  };

  return (
    <>
      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <button type="button" onClick={clear} className="text-muted hover:text-ink">Clear</button>
          <span className="mx-1 h-4 w-px bg-line" />
          <span className="text-muted">Move to</span>
          <select onChange={(e) => { if (e.target.value !== "") { runBulk("folder", e.target.value === "none" ? "" : e.target.value); e.target.selectedIndex = 0; } }} className="h-8 rounded border border-line-2 bg-surface px-2 text-sm capitalize" defaultValue="">
            <option value="" disabled>Folder…</option>
            <option value="none">None</option>
            {ASSET_FOLDERS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <button type="button" onClick={() => { if (confirm(`Delete ${selected.size} asset(s)? Any in use are skipped.`)) runBulk("delete"); }} className="btn-ghost btn-sm text-danger ml-auto">Delete</button>
        </div>
      ) : null}

      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {assets.map((a) => {
          const isSel = selected.has(a.id);
          const src = a.thumb_url ?? a.web_url ?? a.url;
          return (
            <li key={a.id} className={cx("group relative rounded-lg border bg-surface overflow-hidden", isSel ? "border-brand ring-1 ring-brand" : "border-line")}>
              <button type="button" onClick={() => setActive(a)} className="block w-full aspect-square bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={a.alt || a.filename} loading="lazy" className="h-full w-full object-cover" />
              </button>
              <label className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded bg-black/40 opacity-0 group-hover:opacity-100 has-[:checked]:opacity-100 cursor-pointer">
                <input type="checkbox" checked={isSel} onChange={() => toggle(a.id)} className="h-4 w-4" aria-label={`Select ${a.filename}`} />
              </label>
              <div className="px-2 py-1.5">
                <p className="truncate text-xs" title={a.filename}>{a.filename}</p>
                <p className="text-[11px] text-muted">{formatBytes(a.size_bytes)}{a.folder ? ` · ${a.folder}` : ""}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <AssetDrawer asset={active} onClose={() => setActive(null)} onChanged={() => { setActive(null); router.refresh(); }} />
    </>
  );
}

function AssetDrawer({ asset, onClose, onChanged }: { asset: Asset | null; onClose: () => void; onChanged: () => void }) {
  const [uses, setUses] = useState<string[] | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string[] | null>(null);
  const [pending, start] = useTransition();

  // Load uses when a new asset opens (guarded so it runs once per asset, event-free).
  if (asset && loadedFor !== asset.id) {
    setLoadedFor(asset.id);
    setUses(null);
    setBlocked(null);
    void assetUsesAction(asset.id).then(setUses);
  }

  if (!asset) return null;
  const preview = asset.web_url ?? asset.url;

  const save = (fd: FormData) => { fd.set("id", asset.id); start(async () => { await updateAssetAction(fd); onChanged(); }); };
  const remove = () => {
    const fd = new FormData(); fd.set("id", asset.id);
    start(async () => {
      const res = await deleteAssetAction(fd);
      if (res.ok) onChanged();
      else setBlocked(res.uses ?? []);
    });
  };

  return (
    <Drawer open={Boolean(asset)} onClose={onClose} title="Asset">
      <div className="space-y-4">
        <div className="rounded-lg border border-line bg-surface-2 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={asset.alt || asset.filename} className="w-full max-h-72 object-contain" />
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-muted text-xs">Filename</dt><dd className="truncate" title={asset.filename}>{asset.filename}</dd></div>
          <div><dt className="text-muted text-xs">Size</dt><dd>{formatBytes(asset.size_bytes)}</dd></div>
          <div><dt className="text-muted text-xs">Dimensions</dt><dd>{asset.width && asset.height ? `${asset.width} × ${asset.height}` : "—"}</dd></div>
          <div><dt className="text-muted text-xs">Type</dt><dd>{asset.content_type ?? "image"}</dd></div>
        </dl>

        <form action={save} className="space-y-3">
          <label className="block"><span className="text-sm font-medium">Alt text</span>
            <input name="alt" defaultValue={asset.alt} placeholder="Describe the image for screen readers" className="mt-1 w-full h-10 rounded-lg border border-line-2 bg-surface px-3 text-sm" />
          </label>
          <label className="block"><span className="text-sm font-medium">Tags</span>
            <input name="tags" defaultValue={asset.tags.join(", ")} placeholder="comma, separated" className="mt-1 w-full h-10 rounded-lg border border-line-2 bg-surface px-3 text-sm" />
          </label>
          <label className="block"><span className="text-sm font-medium">Folder</span>
            <select name="folder" defaultValue={asset.folder ?? ""} className="mt-1 w-full h-10 rounded-lg border border-line-2 bg-surface px-3 text-sm capitalize">
              <option value="">None</option>
              {ASSET_FOLDERS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        </form>

        <div className="rounded-lg border border-line p-3 text-sm">
          <p className="font-medium">Where it&rsquo;s used</p>
          {uses === null ? <p className="text-muted text-xs mt-1">Checking…</p> : uses.length ? (
            <ul className="mt-1 list-disc pl-5 text-ink-2">{uses.map((u) => <li key={u}>{u}</li>)}</ul>
          ) : <p className="text-muted text-xs mt-1">Not used anywhere. Safe to delete.</p>}
        </div>

        {blocked && blocked.length ? (
          <p className="rounded-lg border border-danger/20 bg-danger-bg p-3 text-sm text-danger">In use in {blocked.join(", ")}. Remove it there first.</p>
        ) : null}

        <button type="button" onClick={remove} disabled={pending} className="btn-ghost btn-sm text-danger">Delete asset</button>
      </div>
    </Drawer>
  );
}
