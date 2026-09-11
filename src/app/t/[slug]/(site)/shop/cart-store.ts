import type { StoreLicense, StoreResolution } from "@/lib/types";
import { trackStore } from "./track";

/**
 * A tiny client-side cart kept in localStorage, scoped per studio slug (tenants
 * share one origin on the platform domain, so the key must include the slug).
 * Only selections and a display price are stored; the server recomputes every
 * charge amount at checkout, so nothing here is trusted for money.
 */
export type CartItem = {
  key: string;
  productId: string;
  productSlug: string;
  title: string;
  resolution: StoreResolution;
  license: StoreLicense;
  priceCents: number;
  /** Rights-managed usage scope (usage/term/territory), when the licence is `rm`. */
  usage?: Record<string, string>;
};

const keyFor = (slug: string) => `pr.cart.${slug}`;
const EVT = "pr-cart-change";

export function itemKey(productId: string, resolution: string, license: string) {
  return `${productId}:${resolution}:${license}`;
}

export function readCart(slug: string): CartItem[] {
  try {
    const raw = localStorage.getItem(keyFor(slug));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as CartItem[]).filter((i) => i && typeof i.productId === "string") : [];
  } catch {
    return [];
  }
}

function writeCart(slug: string, items: CartItem[]) {
  try {
    localStorage.setItem(keyFor(slug), JSON.stringify(items));
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* storage unavailable (private mode, quota) — the cart is best-effort */
  }
}

export function addToCart(slug: string, item: CartItem) {
  const items = readCart(slug);
  const isNew = !items.some((i) => i.key === item.key);
  if (isNew) items.push(item);
  writeCart(slug, items);
  if (isNew) trackStore("cart_add", item.productId);
}

export function removeFromCart(slug: string, key: string) {
  writeCart(slug, readCart(slug).filter((i) => i.key !== key));
}

export function clearCart(slug: string) {
  writeCart(slug, []);
}

/** Subscribe to cart changes (this tab and others). Returns an unsubscribe fn. */
export function onCartChange(fn: () => void) {
  window.addEventListener(EVT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener("storage", fn);
  };
}
