"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MembershipRole } from "@/lib/types";
import { cx } from "@/components/ui";

const items: Array<{ href: string; label: string; minRole?: MembershipRole; exact?: boolean }> = [
  { href: "/studio", label: "Dashboard", exact: true },
  { href: "/studio/inbox", label: "Inbox" },
  { href: "/studio/clients", label: "Clients" },
  { href: "/studio/sessions", label: "Sessions" },
  { href: "/studio/calendar", label: "Calendar" },
  { href: "/studio/tasks", label: "Tasks" },
  { href: "/studio/galleries", label: "Galleries" },
  { href: "/studio/website", label: "Website" },
  { href: "/studio/portfolio", label: "Portfolio" },
  { href: "/studio/assets", label: "Assets" },
  { href: "/studio/emails", label: "Emails" },
  { href: "/studio/bookings", label: "Bookings" },
  { href: "/studio/referrals", label: "Referrals" },
  { href: "/studio/billing", label: "Billing", minRole: "admin" },
  { href: "/studio/settings", label: "Settings", minRole: "admin" },
];

const rank: Record<MembershipRole, number> = { member: 0, admin: 1, owner: 2 };

export function StudioNav({ role }: { role: MembershipRole }) {
  const pathname = usePathname();
  return (
    <nav className="px-2 pb-3 lg:pb-0 flex lg:flex-col gap-1 overflow-x-auto" aria-label="Studio">
      {items
        .filter((i) => !i.minRole || rank[role] >= rank[i.minRole])
        .map((i) => {
          const active = i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={cx("rounded-md px-3 py-2 text-sm whitespace-nowrap", active ? "bg-surface-2 text-ink font-medium" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
            >
              {i.label}
            </Link>
          );
        })}
    </nav>
  );
}
