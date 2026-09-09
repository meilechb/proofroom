"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Counts marketing page views per path per day (plan 8.21). No cookie, no
 * identifier, no query string. Skipped when the browser asks not to be tracked.
 */
export function PageViewBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    if (navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    const body = JSON.stringify({ path: pathname, referrer: document.referrer ? new URL(document.referrer).hostname : null });
    try {
      if (!navigator.sendBeacon?.("/api/track/marketing", new Blob([body], { type: "application/json" }))) {
        void fetch("/api/track/marketing", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
      }
    } catch {
      // Analytics must never break the page.
    }
  }, [pathname]);
  return null;
}
