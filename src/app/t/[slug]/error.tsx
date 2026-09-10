"use client";

import { useEffect } from "react";

export default function TenantError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="mx-auto w-full max-w-md px-5 py-24 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-[var(--site-ink-2,#5b5b60)]">Please refresh, or come back in a moment.</p>
      <button onClick={reset} className="mt-6 h-11 px-5 rounded-lg border border-[var(--site-line,#e6e4e0)] font-medium">Try again</button>
    </div>
  );
}
