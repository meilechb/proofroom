import "server-only";

import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

/**
 * Anonymous, no-login identity for storefront favourites. A random key in a
 * long-lived cookie ties a browser's wishlist together without an account.
 * Reading is safe anywhere; minting sets a cookie, so call ensureBuyerKey only
 * from a server action or route handler.
 */
export const BUYER_KEY_COOKIE = "sf_key";

export async function readBuyerKey(): Promise<string | null> {
  return (await cookies()).get(BUYER_KEY_COOKIE)?.value ?? null;
}

export async function ensureBuyerKey(): Promise<string> {
  const store = await cookies();
  const existing = store.get(BUYER_KEY_COOKIE)?.value;
  if (existing) return existing;
  const key = randomUUID();
  store.set(BUYER_KEY_COOKIE, key, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 400 * 86400 });
  return key;
}
