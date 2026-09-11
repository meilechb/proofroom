"use client";

import { useState } from "react";

/** Lightweight social-share row for a product (S26.2). No SDKs — intent links + copy. */
export function ShareRow({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const x = `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;
  const pin = `https://pinterest.com/pin/create/button/?url=${enc(url)}&description=${enc(title)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the link is in the address bar */
    }
  };

  return (
    <div className="mt-5 flex items-center gap-4 text-xs text-[var(--site-ink-2)]">
      <span>Share</span>
      <a href={x} target="_blank" rel="noreferrer" className="hover:text-[var(--site-ink)]">X</a>
      <a href={fb} target="_blank" rel="noreferrer" className="hover:text-[var(--site-ink)]">Facebook</a>
      <a href={pin} target="_blank" rel="noreferrer" className="hover:text-[var(--site-ink)]">Pinterest</a>
      <button type="button" onClick={copy} className="hover:text-[var(--site-ink)]">{copied ? "Link copied" : "Copy link"}</button>
    </div>
  );
}
