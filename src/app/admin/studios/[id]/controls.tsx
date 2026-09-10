"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { suspendStudioAction, extendTrialAction, compStudioAction, forceReadOnlyAction, schedulePurgeAction, cancelPurgeAction, startImpersonationAction } from "../actions";

type Flags = { suspended: boolean; comped: boolean; readOnly: boolean; purging: boolean };

export function StudioControls({ id, flags }: { id: string; flags: Flags }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [trialDays, setTrialDays] = useState(14);
  const [purgeDays, setPurgeDays] = useState(30);
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => startImpersonationAction(id))}>Impersonate (read-only)</Button>
        {flags.suspended
          ? <Button size="sm" disabled={pending} onClick={() => run(() => suspendStudioAction(id, false))}>Unsuspend</Button>
          : <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (confirm("Suspend this studio? The team is locked out.")) run(() => suspendStudioAction(id, true)); }} className="text-danger">Suspend</Button>}
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => compStudioAction(id, !flags.comped))}>{flags.comped ? "Remove comp" : "Comp (free)"}</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => forceReadOnlyAction(id, !flags.readOnly))}>{flags.readOnly ? "Clear read-only" : "Force read-only"}</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted">Extend trial by</span>
        <input type="number" min={1} max={365} value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value) || 1)} className="h-8 w-16 rounded border border-line-2 bg-surface px-2" />
        <span className="text-muted">days</span>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => extendTrialAction(id, trialDays))}>Extend</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-danger/30 p-3">
        {flags.purging ? (
          <>
            <span className="text-danger">Purge scheduled.</span>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => cancelPurgeAction(id))}>Cancel purge</Button>
          </>
        ) : (
          <>
            <span className="text-muted">Schedule purge in</span>
            <input type="number" min={0} max={365} value={purgeDays} onChange={(e) => setPurgeDays(Number(e.target.value) || 0)} className="h-8 w-16 rounded border border-line-2 bg-surface px-2" />
            <span className="text-muted">days</span>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (confirm("Soft-delete now and schedule a hard purge? This blocks all access.")) run(() => schedulePurgeAction(id, purgeDays)); }} className="text-danger">Schedule purge</Button>
          </>
        )}
      </div>
    </div>
  );
}
