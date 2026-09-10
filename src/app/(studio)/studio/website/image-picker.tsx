"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { cx } from "@/components/ui";

export type PickerAsset = { id: string; thumb: string; filename: string; alt: string };

/**
 * Picks an image from the studio's asset library for a site section (plan
 * 14.18.3). Shows the current selection and its alt text; alt is edited on the
 * asset itself in /studio/assets, so it stays consistent everywhere.
 */
export function ImagePicker({ label, value, assets, onChange }: { label: string; value: string | null; assets: PickerAsset[]; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = value ? assets.find((a) => a.id === value) ?? null : null;
  const shown = q.trim() ? assets.filter((a) => `${a.filename} ${a.alt}`.toLowerCase().includes(q.trim().toLowerCase())) : assets;

  return (
    <div>
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1 flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line-2 bg-surface-2">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.thumb} alt={current.alt || current.filename} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-muted">None</div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm w-fit">{current ? "Change image" : "Choose image"}</button>
          {current ? <button type="button" onClick={() => onChange(null)} className="text-xs text-muted hover:text-danger w-fit">Remove</button> : null}
        </div>
      </div>
      {current && !current.alt ? <p className="mt-1 text-xs text-warning">This image has no alt text. Add it in Assets for accessibility and SEO.</p> : null}

      <Dialog open={open} onClose={() => setOpen(false)} title={`Choose image — ${label}`}>
        {assets.length === 0 ? (
          <p className="text-sm text-ink-2">No images yet. Upload some under Assets, then come back.</p>
        ) : (
          <div className="space-y-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search images" className="w-full h-9 rounded-lg border border-line-2 bg-surface px-3 text-sm" />
            <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto">
              {shown.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(a.id); setOpen(false); }}
                    className={cx("block w-full aspect-square overflow-hidden rounded-lg border-2", a.id === value ? "border-brand" : "border-transparent hover:border-line-2")}
                    title={a.filename}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.thumb} alt={a.alt || a.filename} loading="lazy" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Dialog>
    </div>
  );
}
