"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

/** Dropdown menu with arrow-key navigation (plan 4.13). Items are buttons or links you pass in. */
export function Menu({ label, icon, children, align = "right", className }: { label?: string; icon?: ReactNode; children: ReactNode; align?: "left" | "right"; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        if (items.length === 0) return;
        e.preventDefault();
        const idx = items.indexOf(document.activeElement as HTMLElement);
        const next = e.key === "ArrowDown" ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
        items[next].focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={root} className={cx("relative inline-block", className)}>
      <button type="button" className={cx("btn-secondary btn-sm", !label && "px-2")} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {icon ?? (label ? null : <Icon.Dots />)}
        {label}
        {label ? <Icon.ChevronDown size={14} /> : null}
      </button>
      {open ? (
        <div id={id} role="menu" className={cx("absolute z-40 mt-1 min-w-44 card p-1 shadow-lg", align === "right" ? "right-0" : "left-0")} onClick={() => setOpen(false)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({ children, danger, ...props }: React.ComponentProps<"button"> & { danger?: boolean }) {
  return (
    <button type="button" role="menuitem" {...props} className={cx("w-full text-left rounded-md px-3 py-2 text-sm hover:bg-surface-2 focus:bg-surface-2 focus:outline-none", danger && "text-danger", props.className)}>
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 border-t border-line" />;
}
