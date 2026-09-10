"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";

/** Live progress for a running import; polls by refreshing the server component (plan 21.3). */
export function RunningView({ processed, total, galleries, log }: { importId: string; processed: number; total: number; galleries: number; log: string[] }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [router]);

  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  return (
    <Card>
      <h2 className="font-medium">Importing…</h2>
      <p className="mt-1 text-sm text-ink-2">{processed} of {total} photos across {galleries} galleries. This continues even if you close the page.</p>
      <div className="mt-3 h-2 rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
      {log.length ? (
        <details className="mt-4 text-sm"><summary className="cursor-pointer text-muted">Activity log</summary><ul className="mt-2 space-y-1 text-xs text-muted max-h-48 overflow-y-auto">{log.slice(-40).map((l, i) => <li key={i}>{l}</li>)}</ul></details>
      ) : null}
    </Card>
  );
}
