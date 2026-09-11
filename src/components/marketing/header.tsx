"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icons";
import { Logo, cx } from "@/components/ui";

export const MARKETING_NAV: Array<{ href: string; label: string }> = [
  { href: "/features/galleries", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/lightroom", label: "Lightroom" },
  { href: "/compare/pixieset", label: "Compare" },
];

/** Signup link that carries ?ref= through from any marketing page (plan 8.22). */
function StartFreeInner({ className, children }: { className?: string; children: React.ReactNode }) {
  const params = useSearchParams();
  const ref = params.get("ref");
  const href = ref && /^[A-Za-z0-9]{4,16}$/.test(ref) ? `/signup?ref=${encodeURIComponent(ref)}` : "/signup";
  return <Link href={href} className={className}>{children}</Link>;
}

export function StartFreeLink({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <Suspense fallback={<Link href="/signup" className={className}>{children}</Link>}>
      <StartFreeInner className={className}>{children}</StartFreeInner>
    </Suspense>
  );
}

function isActive(pathname: string, href: string) {
  const section = href.split("/")[1];
  return pathname === href || pathname.startsWith(`/${section}/`) || pathname === `/${section}`;
}

export function MarketingHeader({ appName }: { appName: string }) {
  const pathname = usePathname();
  // The menu is "open for this path": navigating anywhere closes it without a setState-in-effect.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function onPanelKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      setOpenPath(null);
      toggleRef.current?.focus();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    // Focus trap: Tab cycles within the panel while it is open (plan 8.2).
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <div className="container-x h-16 flex items-center justify-between gap-6">
        <Link href="/" className="inline-flex items-center gap-2 font-display text-lg" aria-label={`${appName} home`}>
          <Logo name={appName} /> {appName}
        </Link>
        <nav className="hidden md:flex items-center gap-1" aria-label="Main">
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cx("rounded-md px-3 py-2 text-sm", isActive(pathname, item.href) ? "text-ink font-medium" : "text-ink-2 hover:text-ink hover:bg-surface-2")}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-2">
          <Link href="/login" className="btn-ghost">Log in</Link>
          <StartFreeLink className="btn-primary btn-pill">Start free</StartFreeLink>
        </div>
        <button
          ref={toggleRef}
          type="button"
          className="md:hidden btn-ghost -mr-2 px-2"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpenPath(open ? null : pathname)}
        >
          {open ? <Icon.X size={22} /> : <Icon.Menu size={22} />}
        </button>
      </div>
      {open ? (
        <div
          id="mobile-nav"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          onKeyDown={onPanelKeyDown}
          className="md:hidden fixed inset-x-0 top-16 bottom-0 z-40 bg-paper border-t border-line overflow-y-auto"
        >
          <nav className="container-x py-4 flex flex-col" aria-label="Main">
            {MARKETING_NAV.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-md px-3 py-3 text-base text-ink hover:bg-surface-2" aria-current={isActive(pathname, item.href) ? "page" : undefined}>
                {item.label}
              </Link>
            ))}
            <Link href="/security" className="rounded-md px-3 py-3 text-base text-ink hover:bg-surface-2">Security</Link>
            <Link href="/contact" className="rounded-md px-3 py-3 text-base text-ink hover:bg-surface-2">Contact</Link>
          </nav>
          <div className="container-x pb-8 flex flex-col gap-2">
            <StartFreeLink className="btn-primary btn-lg btn-pill">Start free</StartFreeLink>
            <Link href="/login" className="btn-secondary btn-lg btn-pill">Log in</Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
