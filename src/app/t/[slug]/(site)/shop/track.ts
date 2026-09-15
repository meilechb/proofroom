/**
 * Fire-and-forget store funnel beacons (S25) to /api/track/store. Client only:
 * the studio is resolved server-side from the tenant host. Honours Do Not Track
 * / Global Privacy Control and never throws.
 */
export type StoreBeaconEvent = "store_view" | "product_view" | "cart_add";

export function trackStore(event: StoreBeaconEvent, target?: string) {
  if (typeof navigator === "undefined") return;
  if (navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
  const body = JSON.stringify({ event, target });
  try {
    if (!navigator.sendBeacon?.("/api/track/store", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/track/store", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {
    // Analytics must never break the storefront.
  }
}
