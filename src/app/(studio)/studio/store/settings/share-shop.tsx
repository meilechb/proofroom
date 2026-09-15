"use client";

import { useState } from "react";

function CopyRow({ label, hint, value }: { label: string; hint?: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the buyer can select the text manually */
    }
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="text-sm font-medium">{label}</span>
        <button type="button" onClick={copy} className="text-xs text-muted hover:text-ink">{copied ? "Copied" : "Copy"}</button>
      </div>
      {hint ? <p className="hint mb-1">{hint}</p> : null}
      <pre className="card card-pad overflow-x-auto text-xs whitespace-pre-wrap break-all">{value}</pre>
    </div>
  );
}

export function ShareShop({ shopUrl, snippet }: { shopUrl: string; snippet: string }) {
  return (
    <section className="mt-10 space-y-4">
      <div>
        <h2 className="text-sm font-medium">Share &amp; embed</h2>
        <p className="hint">Link to your shop from anywhere, or paste the button onto another site.</p>
      </div>
      <CopyRow label="Shop link" value={shopUrl} />
      <CopyRow label="Buy button for your site" hint="Plain HTML — works on any website builder that allows an embed or HTML block." value={snippet} />
    </section>
  );
}
