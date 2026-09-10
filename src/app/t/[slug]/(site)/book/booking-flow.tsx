"use client";

import { useState, useTransition } from "react";
import { formatMoney } from "@/lib/types";
import { BookingCalendar, prettyDate } from "@/components/site/booking-calendar";
import { availableSlotsAction, bookAction, type SlotOption } from "./actions";

type Pkg = { id: string; name: string; description: string | null; price_cents: number; deposit_cents: number; duration_minutes: number | null };

type Props = {
  slug: string;
  packages: Pkg[];
  currency: string;
  timezone: string;
  minDateISO: string;
  maxDateISO: string;
  openWeekdays: number[];
  blockedDates: string[];
  depositRequired: boolean;
  canPayNow: boolean;
  policy: string;
};

export function BookingFlow(props: Props) {
  const { slug, packages, currency, minDateISO, maxDateISO, openWeekdays, blockedDates, depositRequired, canPayNow, policy } = props;
  const [pkg, setPkg] = useState<Pkg | null>(packages.length === 1 ? packages[0] : null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [slot, setSlot] = useState<SlotOption | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ when: string; hubUrl: string } | null>(null);
  const [loadingSlots, startSlots] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const btn = "h-11 px-6 rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] font-medium disabled:opacity-50";
  const field = "w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 h-11";

  function pickPackage(p: Pkg) {
    setPkg(p);
    setDate(null);
    setSlots(null);
    setSlot(null);
    setError(null);
  }

  function pickDate(dateISO: string) {
    setDate(dateISO);
    setSlot(null);
    setSlots(null);
    setError(null);
    if (!pkg) return;
    startSlots(async () => {
      const res = await availableSlotsAction(slug, pkg.id, dateISO);
      if (res.ok) setSlots(res.slots);
      else { setSlots([]); setError(res.error); }
    });
  }

  function submit(formData: FormData) {
    if (!pkg || !slot) return;
    setError(null);
    startSubmit(async () => {
      const res = await bookAction(slug, {
        packageId: pkg.id,
        slotISO: slot.iso,
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        agreed,
      });
      if (!res.ok) { setError(res.error); return; }
      if (res.checkoutUrl) { window.location.href = res.checkoutUrl; return; }
      setDone({ when: res.when, hubUrl: res.hubUrl });
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-[var(--site-line)] p-8 text-center">
        <h2 className="text-xl font-medium" style={{ fontFamily: "var(--site-font-heading)" }}>You&apos;re booked.</h2>
        <p className="mt-2 text-[var(--site-ink-2)]">{done.when}. A confirmation is on its way to your inbox.</p>
        <a href={done.hubUrl} className={`mt-6 inline-flex items-center ${btn}`}>View your booking</a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Step n={1} title="Choose a package" done={!!pkg}>
        <div className="grid gap-3 sm:grid-cols-2">
          {packages.map((p) => (
            <button key={p.id} type="button" onClick={() => pickPackage(p)} className={`text-left rounded-xl border p-4 transition ${pkg?.id === p.id ? "border-[var(--site-primary)] ring-1 ring-[var(--site-primary)]" : "border-[var(--site-line)] hover:border-[var(--site-ink-2)]"}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{p.name}</span>
                <span className="text-[var(--site-ink-2)]">{formatMoney(p.price_cents, currency)}</span>
              </div>
              {p.description ? <p className="mt-1 text-sm text-[var(--site-ink-2)] line-clamp-2">{p.description}</p> : null}
              <p className="mt-2 text-xs text-[var(--site-ink-2)]">{p.duration_minutes ? `${p.duration_minutes} min` : "About 1 hour"}{p.deposit_cents > 0 && depositRequired ? ` · ${formatMoney(p.deposit_cents, currency)} deposit` : ""}</p>
            </button>
          ))}
        </div>
      </Step>

      {pkg ? (
        <Step n={2} title="Pick a date and time" done={!!slot}>
          <BookingCalendar minDateISO={minDateISO} maxDateISO={maxDateISO} openWeekdays={openWeekdays} blockedDates={blockedDates} selected={date} onPick={pickDate} />
          {date ? (
            <div className="mt-5">
              <p className="text-sm font-medium">{prettyDate(date)}</p>
              {loadingSlots ? (
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
        </Step>
      ) : null}

      {pkg && slot ? (
        <Step n={3} title="Your details" done={false}>
          <form action={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">Name<input name="name" required autoComplete="name" className={`mt-1 ${field}`} /></label>
              <label className="block text-sm">Email<input name="email" type="email" required autoComplete="email" className={`mt-1 ${field}`} /></label>
            </div>
            <label className="block text-sm">Phone<input name="phone" type="tel" autoComplete="tel" className={`mt-1 ${field}`} /></label>
            <label className="block text-sm">Anything we should know?<textarea name="notes" rows={3} className="mt-1 w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 py-2" /></label>
            {policy ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4" />
                <span>I agree to the booking policy: <span className="text-[var(--site-ink-2)]">{policy}</span></span>
              </label>
            ) : null}
            {error ? <p className="text-sm text-red-500" role="alert">{error}</p> : null}
            <button type="submit" disabled={submitting || (!!policy && !agreed)} className={btn}>
              {submitting ? "Booking…" : depositRequired && canPayNow && pkg.deposit_cents > 0 ? `Book and pay ${formatMoney(pkg.deposit_cents, currency)} deposit` : "Confirm booking"}
            </button>
            <p className="text-xs text-[var(--site-ink-2)]">{formatMoney(pkg.price_cents, currency)} · {prettyDate(slot.iso.slice(0, 10))}, {slot.label}</p>
          </form>
        </Step>
      ) : null}

      {error && !slot ? <p className="text-sm text-red-500" role="alert">{error}</p> : null}
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-[var(--site-ink-2)]">
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${done ? "bg-[var(--site-primary)] text-[var(--site-primary-ink)]" : "border border-[var(--site-line)]"}`}>{done ? "✓" : n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

