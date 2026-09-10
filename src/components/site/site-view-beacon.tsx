"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Counts a studio's public-site views per path per day (plan 14.27). No cookie,
 * no identifier, no query string. Skipped when the browser asks not to be
 * tracked. The path posted is the tenant-facing path (e.g. /portfolio); the
 * server resolves the studio from the host.
 */
export function SiteViewBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    if (navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    // Server components render tenant pages under /t/[slug]; the public URL drops that prefix.
    const path = pathname.replace(/^\/t\/[^/]+/, "") || "/";
    const body = JSON.stringify({ path });
    try {
      if (!navigator.sendBeacon?.("/api/track/site", new Blob([body], { type: "application/json" }))) {
        void fetch("/api/track/site", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
      }
    } catch {
      // Analytics must never break the page.
    }
  }, [pathname]);
  return null;
}
