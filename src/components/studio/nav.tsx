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
  { href: "/studio/packages", label: "Packages", minRole: "admin" },
  { href: "/studio/store", label: "Store", minRole: "admin" },
  { href: "/studio/calendar", label: "Calendar" },
  { href: "/studio/tasks", label: "Tasks" },
  { href: "/studio/galleries", label: "Galleries" },
  { href: "/studio/website", label: "Website" },
  { href: "/studio/portfolio", label: "Portfolio" },
  { href: "/studio/assets", label: "Assets" },
  { href: "/studio/emails", label: "Emails" },
  { href: "/studio/bookings", label: "Bookings" },
  { href: "/studio/referrals", label: "Referrals" },
  { href: "/studio/import", label: "Import", minRole: "admin" },
  { href: "/studio/billing", label: "Billing", minRole: "admin" },
  { href: "/studio/settings", label: "Settings", minRole: "admin" },
];

const rank: Record<MembershipRole, number> = { member: 0, admin: 1, owner: 2 };

export function StudioNav({ role, badges = {} }: { role: MembershipRole; badges?: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav className="px-2 pb-3 lg:pb-0 lg:pt-1 flex lg:flex-col gap-0.5 overflow-x-auto" aria-label="Studio">
      {items
        .filter((i) => !i.minRole || rank[role] >= rank[i.minRole])
        .map((i) => {
          const active = i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors flex items-center justify-between gap-2",
                active ? "bg-white/12 text-white font-medium" : "text-white/70 hover:bg-white/8 hover:text-white",
              )}
            >
              <span>{i.label}</span>
              {badges[i.href] ? <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-white/90 text-ink px-1.5 text-[11px] font-medium" aria-label={`${badges[i.href]} new`}>{badges[i.href] > 99 ? "99+" : badges[i.href]}</span> : null}
            </Link>
          );
        })}
    </nav>
  );
}
