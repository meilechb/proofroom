"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cancelBookingAction } from "./booking-actions";

export function BookingManage({ slug, token, bookingId, label, canChange }: { slug: string; token: string; bookingId: string; label: string; canChange: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  function cancel() {
    if (!confirm("Cancel this session? This cannot be undone.")) return;
    setMsg(null);
    start(async () => {
      const res = await cancelBookingAction(slug, token, bookingId);
      if (res.ok) { setGone(true); setMsg(res.message); }
      else setMsg(res.error);
    });
  }

  if (gone) return <div className="flex items-center justify-between border-b border-[var(--site-line)] py-3 text-sm last:border-0"><span className="text-[var(--site-ink-2)] line-through">{label}</span><span className="text-[var(--site-ink-2)]">{msg}</span></div>;

  return (
    <div className="border-b border-[var(--site-line)] py-3 text-sm last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {canChange ? (
          <span className="flex items-center gap-3">
            <Link href={`/my/${token}/reschedule/${bookingId}`} className="text-[var(--site-ink-2)] underline">Reschedule</Link>
            <button type="button" onClick={cancel} disabled={pending} className="text-[var(--site-ink-2)] underline disabled:opacity-50">{pending ? "Cancelling…" : "Cancel"}</button>
          </span>
        ) : (
          <span className="text-[var(--site-ink-2)] text-xs">Contact the studio to change</span>
        )}
      </div>
      {msg && !gone ? <p className="mt-1 text-red-500 text-xs">{msg}</p> : null}
    </div>
  );
}
