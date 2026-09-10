"use client";

import { useEffect } from "react";

/** Opens the browser print dialog on load, and offers a button to print again. */
export function PrintButton() {
  useEffect(() => { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t); }, []);
  return <button type="button" onClick={() => window.print()} className="print:hidden rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">Print</button>;
}
