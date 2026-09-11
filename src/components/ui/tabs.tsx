"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cx } from "@/components/ui";

/** Tabs whose active item lives in a query parameter, so links are shareable and the server can read it (plan 4.12). */
export function Tabs({ param = "tab", items, defaultValue, className }: { param?: string; items: { value: string; label: string; count?: number }[]; defaultValue?: string; className?: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const active = search.get(param) ?? defaultValue ?? items[0]?.value;
  return (
    <nav className={cx("flex gap-1 border-b border-line overflow-x-auto", className)} aria-label="Sections">
      {items.map((item) => {
        const params = new URLSearchParams(search.toString());
        if (item.value === (defaultValue ?? items[0]?.value)) params.delete(param);
        else params.set(param, item.value);
        params.delete("cursor");
        const qs = params.toString();
        const isActive = active === item.value;
        return (
          <Link
            key={item.value}
            href={qs ? `${pathname}?${qs}` : pathname}
            aria-current={isActive ? "page" : undefined}
            className={cx("px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px", isActive ? "border-brand text-brand font-medium" : "border-transparent text-ink-2 hover:text-ink")}
          >
            {item.label}
            {item.count !== undefined ? <span className="ml-1.5 text-xs text-muted">{item.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
