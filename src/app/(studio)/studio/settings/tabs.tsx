"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const TABS = [
  { href: "/studio/settings", label: "Profile" },
  { href: "/studio/settings/branding", label: "Branding" },
  { href: "/studio/settings/domain", label: "Domain" },
  { href: "/studio/settings/payments", label: "Payments" },
  { href: "/studio/settings/email-domain", label: "Email domain" },
  { href: "/studio/settings/agreement", label: "Agreement" },
  { href: "/studio/settings/bookings", label: "Bookings" },
  { href: "/studio/settings/team", label: "Team" },
  { href: "/studio/settings/lightroom", label: "Lightroom" },
  { href: "/studio/settings/data", label: "Data" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-line overflow-x-auto" aria-label="Settings sections">
      {TABS.map((t) => {
        const active = t.href === "/studio/settings" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cx("px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px", active ? "border-brand text-brand font-medium" : "border-transparent text-ink-2 hover:text-ink")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
