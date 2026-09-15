"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { clearCart } from "../../../(site)/shop/cart-store";

/** Payment succeeded — empty this studio's cart for the buyer's browser. */
export function ClearCart() {
  const params = useParams();
  useEffect(() => {
    const slug = typeof params?.slug === "string" ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : null;
    if (slug) clearCart(slug);
  }, [params]);
  return null;
}
