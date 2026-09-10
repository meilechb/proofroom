"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BookingCalendar, prettyDate } from "@/components/site/booking-calendar";
import { rescheduleSlotsAction, rescheduleBookingAction, type SlotOption } from "../../booking-actions";

type Props = {
  slug: string;
  token: string;
  bookingId: string;
  currentLabel: string;
  minDateISO: string;
  maxDateISO: string;
  openWeekdays: number[];
  blockedDates: string[];
  extraOpenDates: string[];
};

export function RescheduleFlow({ slug, token, bookingId, currentLabel, minDateISO, maxDateISO, openWeekdays, blockedDates, extraOpenDates }: Props) {
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [slot, setSlot] = useState<SlotOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();

  const btn = "h-11 px-6 rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] font-medium disabled:opacity-50";

  function pickDate(dateISO: string) {
    setDate(dateISO); setSlot(null); setSlots(null); setError(null);
    startLoad(async () => {
      const res = await rescheduleSlotsAction(slug, token, bookingId, dateISO);
      if (res.ok) setSlots(res.slots);
      else { setSlots([]); setError(res.error); }
    });
  }

  function save() {
    if (!slot) return;
    setError(null);
    startSave(async () => {
      const res = await rescheduleBookingAction(slug, token, bookingId, slot.iso);
      if (res.ok) setDone(res.message);
      else setError(res.error);
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-[var(--site-line)] p-8 text-center">
        <p className="font-medium">Your session has been moved.</p>
        <p className="mt-1 text-[var(--site-ink-2)]">{done}</p>
        <Link href={`/my/${token}`} className={`mt-6 inline-flex items-center ${btn}`}>Back to your portal</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--site-ink-2)]">Currently booked for <span className="text-[var(--site-ink)]">{currentLabel}</span>. Pick a new day and time.</p>
      <BookingCalendar minDateISO={minDateISO} maxDateISO={maxDateISO} openWeekdays={openWeekdays} blockedDates={blockedDates} extraOpenDates={extraOpenDates} selected={date} onPick={pickDate} />
      {date ? (
        <div>
          <p className="text-sm font-medium">{prettyDate(date)}</p>
          {loading ? (
            <p className="mt-2 text-sm text-[var(--site-ink-2)]">Finding open times…</p>
          ) : slots && slots.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {slots.map((s) => (
                <button key={s.iso} type="button" onClick={() => { setSlot(s); setError(null); }} className={`h-10 px-4 rounded-lg border text-sm ${slot?.iso === s.iso ? "border-[var(--site-primary)] bg-[var(--site-primary)] text-[var(--site-primary-ink)]" : "border-[var(--site-line)] hover:border-[var(--site-ink-2)]"}`}>{s.label}</button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[var(--site-ink-2)]">No open times that day. Try another date.</p>
          )}
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-500" role="alert">{error}</p> : null}
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={!slot || saving} className={btn}>{saving ? "Moving…" : "Move my session"}</button>
        <Link href={`/my/${token}`} className="text-sm text-[var(--site-ink-2)] underline">Cancel</Link>
      </div>
    </div>
  );
}
