"use client";

import { useMemo, useState } from "react";

/** Month calendar for the booking and reschedule flows. Days outside the range,
 *  closed weekdays and blocked dates are disabled; the server has the final say. */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function weekday(dateISO: string) {
  return new Date(`${dateISO}T12:00:00Z`).getUTCDay();
}

export function BookingCalendar({ minDateISO, maxDateISO, openWeekdays, blockedDates, extraOpenDates = [], selected, onPick }: { minDateISO: string; maxDateISO: string; openWeekdays: number[]; blockedDates: string[]; extraOpenDates?: string[]; selected: string | null; onPick: (d: string) => void }) {
  const [my, setMy] = useState(() => { const [y, m] = minDateISO.split("-").map(Number); return { y, m: m - 1 }; });
  const open = useMemo(() => new Set(openWeekdays), [openWeekdays]);
  const blocked = useMemo(() => new Set(blockedDates), [blockedDates]);
  const extraOpen = useMemo(() => new Set(extraOpenDates), [extraOpenDates]);
  const lead = weekday(iso(my.y, my.m, 1));
  const daysInMonth = new Date(Date.UTC(my.y, my.m + 1, 0)).getUTCDate();
  const canPrev = iso(my.y, my.m, 1) > minDateISO;
  const canNext = iso(my.y, my.m, daysInMonth) < maxDateISO;

  function shift(delta: number) {
    setMy((cur) => { const d = new Date(Date.UTC(cur.y, cur.m + delta, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  }

  return (
    <div className="max-w-sm">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} disabled={!canPrev} className="h-8 w-8 rounded-lg border border-[var(--site-line)] disabled:opacity-30" aria-label="Previous month">‹</button>
        <span className="text-sm font-medium">{MONTHS[my.m]} {my.y}</span>
        <button type="button" onClick={() => shift(1)} disabled={!canNext} className="h-8 w-8 rounded-lg border border-[var(--site-line)] disabled:opacity-30" aria-label="Next month">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--site-ink-2)]">
        {WEEKDAYS.map((w) => <span key={w} className="py-1">{w}</span>)}
        {Array.from({ length: lead }).map((_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const dISO = iso(my.y, my.m, d);
          const selectable = dISO >= minDateISO && dISO <= maxDateISO && (open.has(weekday(dISO)) || extraOpen.has(dISO)) && !blocked.has(dISO);
          const isSel = selected === dISO;
          return (
            <button key={dISO} type="button" disabled={!selectable} onClick={() => onPick(dISO)}
              className={`aspect-square rounded-lg text-sm ${isSel ? "bg-[var(--site-primary)] text-[var(--site-primary-ink)]" : selectable ? "hover:bg-[var(--site-line)]" : "text-[var(--site-ink-2)]/40 cursor-default"}`}>
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function prettyDate(dateISO: string) {
  return new Date(`${dateISO}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
}
