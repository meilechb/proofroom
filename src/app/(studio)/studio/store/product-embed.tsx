"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the studio can select the text manually */
    }
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="text-sm font-medium">{label}</span>
        <button type="button" onClick={copy} className="text-xs text-muted hover:text-ink">{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre className="card card-pad overflow-x-auto text-xs whitespace-pre-wrap break-all">{value}</pre>
    </div>
  );
}

/** A deep-link "Buy" button a studio can paste on another site (S26.1). */
export function ProductEmbed({ url, snippet }: { url: string; snippet: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setOpen(true)}>Embed</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Embed this product">
        <div className="space-y-4">
          <p className="text-sm text-muted">Link to this product from anywhere, or paste the button onto another site.</p>
          <CopyRow label="Product link" value={url} />
          <CopyRow label="Buy button for your site" value={snippet} />
        </div>
      </Dialog>
    </>
  );
}
