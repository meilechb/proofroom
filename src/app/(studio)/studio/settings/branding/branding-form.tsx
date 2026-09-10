"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { ImagePicker, type PickerAsset } from "../../website/image-picker";
import { saveBrandingAction } from "./actions";

export function BrandingForm({ assets, logoAssetId, faviconAssetId, brandColor }: { assets: PickerAsset[]; logoAssetId: string | null; faviconAssetId: string | null; brandColor: string }) {
  const [logo, setLogo] = useState(logoAssetId);
  const [favicon, setFavicon] = useState(faviconAssetId);
  const [color, setColor] = useState(brandColor);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    const r = await saveBrandingAction({ logoAssetId: logo, faviconAssetId: favicon, brandColor: color });
    setMsg(r.ok ? { ok: true, text: r.message ?? "Saved." } : { ok: false, text: r.error ?? "Could not save." });
  });

  return (
    <div className="space-y-5 max-w-lg">
      {msg ? <div className={msg.ok ? "rounded-lg border border-success/20 bg-success-bg p-3 text-sm text-success" : "rounded-lg border border-danger/20 bg-danger-bg p-3 text-sm text-danger"}>{msg.text}</div> : null}
      {assets.length === 0 ? <p className="text-sm text-ink-2">Upload your logo under <a href="/studio/assets" className="underline">Assets</a> first, then choose it here.</p> : null}
      <ImagePicker label="Logo" value={logo} assets={assets} onChange={setLogo} />
      <ImagePicker label="Favicon" value={favicon} assets={assets} onChange={setFavicon} />
      <label className="block">
        <span className="text-sm font-medium">Brand color</span>
        <div className="mt-1 flex items-center gap-2">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 rounded-lg border border-line-2" aria-label="Brand color" />
          <input value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-32 rounded-lg border border-line-2 bg-surface px-3 text-sm font-mono" />
        </div>
        <span className="text-xs text-muted">Used in app emails and as your default website color.</span>
      </label>
      <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save branding"}</Button>
    </div>
  );
}
