"use client";

import { useEffect, useRef } from "react";
import { trackStore, type StoreBeaconEvent } from "./track";

/** One-shot store funnel beacon on mount (shop = store_view, product page = product_view). */
export function StoreBeacon({ event, target }: { event: StoreBeaconEvent; target?: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackStore(event, target);
  }, [event, target]);
  return null;
}
