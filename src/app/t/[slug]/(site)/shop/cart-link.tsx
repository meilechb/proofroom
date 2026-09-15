"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onCartChange, readCart } from "./cart-store";

/** "Cart (n)" — reads the count from localStorage after mount (SSR renders "Cart"). */
export function CartLink({ slug }: { slug: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(readCart(slug).length);
    update();
    return onCartChange(update);
  }, [slug]);
  return (
    <Link href="/shop/cart" className="text-sm underline text-[var(--site-ink-2)] hover:text-[var(--site-ink)]">
      Cart{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}
