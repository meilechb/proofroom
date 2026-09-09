"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

/**
 * Dialog and Drawer (plan 4.10, 4.11) on the native <dialog> element: the
 * browser gives focus trapping, Escape to close and inert background.
 */
type BaseProps = { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; className?: string; describedBy?: string };

function useNativeDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleClose = () => onClose();
    const handleClick = (e: MouseEvent) => {
      if (e.target === el) onClose(); // backdrop click
    };
    el.addEventListener("close", handleClose);
    el.addEventListener("click", handleClick);
    return () => {
      el.removeEventListener("close", handleClose);
      el.removeEventListener("click", handleClick);
    };
  }, [onClose]);
  return ref;
}

export function Dialog({ open, onClose, title, children, footer, className, describedBy }: BaseProps) {
  const ref = useNativeDialog(open, onClose);
  return (
    <dialog ref={ref} className={cx("m-auto w-[min(92vw,560px)] rounded-2xl border border-line bg-surface text-ink p-0 shadow-2xl backdrop:bg-black/50", className)} aria-labelledby="dialog-title" aria-describedby={describedBy}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <h2 id="dialog-title" className="font-semibold">{title}</h2>
        <button type="button" onClick={onClose} className="btn-ghost btn-sm" aria-label="Close"><Icon.X /></button>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer ? <div className="px-5 py-4 border-t border-line flex justify-end gap-2">{footer}</div> : null}
    </dialog>
  );
}

export function Drawer({ open, onClose, title, children, footer, className }: BaseProps) {
  const ref = useNativeDialog(open, onClose);
  return (
    <dialog ref={ref} className={cx("fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-[min(100vw,440px)] border-l border-line bg-surface text-ink p-0 shadow-2xl backdrop:bg-black/40", className)} aria-labelledby="drawer-title">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 id="drawer-title" className="font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm" aria-label="Close"><Icon.X /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="px-5 py-4 border-t border-line flex justify-end gap-2">{footer}</div> : null}
      </div>
    </dialog>
  );
}
