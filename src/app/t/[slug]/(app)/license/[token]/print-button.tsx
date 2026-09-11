"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center rounded-lg border border-[var(--site-line)] px-3 h-9 text-sm hover:bg-[var(--site-bg-2)]"
    >
      Print / save as PDF
    </button>
  );
}
