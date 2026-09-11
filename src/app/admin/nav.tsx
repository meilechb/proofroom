"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const items = [
  { href: "/admin", label: "Studios", exact: true },
  { href: "/admin/metrics", label: "Metrics" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/emails", label: "Emails" },
  { href: "/admin/referrals", label: "Referrals" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex lg:flex-col gap-1 overflow-x-auto" aria-label="Admin">
      {items.map((i) => {
        const active = i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} className={cx("rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors", active ? "bg-brand/10 text-brand font-medium" : "text-ink-2 hover:bg-surface hover:text-ink")}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
