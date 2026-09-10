"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { type BookingSettings } from "@/lib/booking-shared";
import { saveBookingSettingsAction } from "./actions";

const DAYS = [["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"], ["0", "Sun"]] as const;

export function BookingsForm({ initial }: { initial: BookingSettings }) {
  const [s, setS] = useState<BookingSettings>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const setField = <K extends keyof BookingSettings>(key: K, value: BookingSettings[K]) => setS((prev) => ({ ...prev, [key]: value }));
  const setWindow = (day: string, i: number, field: "start" | "end", value: string) =>
    setS((prev) => ({ ...prev, weekly: { ...prev.weekly, [day]: prev.weekly[day as keyof typeof prev.weekly].map((w, j) => (j === i ? { ...w, [field]: value } : w)) } }));
  const addWindow = (day: string) => setS((prev) => ({ ...prev, weekly: { ...prev.weekly, [day]: [...prev.weekly[day as keyof typeof prev.weekly], { start: "09:00", end: "17:00" }] } }));
  const removeWindow = (day: string, i: number) => setS((prev) => ({ ...prev, weekly: { ...prev.weekly, [day]: prev.weekly[day as keyof typeof prev.weekly].filter((_, j) => j !== i) } }));

  const save = () => start(async () => { const r = await saveBookingSettingsAction(s); setMsg(r.ok ? { ok: true, text: r.message ?? "Saved." } : { ok: false, text: r.error ?? "Could not save." }); });

  return (
    <div className="space-y-6">
      {msg ? <div className={msg.ok ? "rounded-lg border border-success/20 bg-success-bg p-3 text-sm text-success" : "rounded-lg border border-danger/20 bg-danger-bg p-3 text-sm text-danger"}>{msg.text}</div> : null}

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={s.enabled} onChange={(e) => setField("enabled", e.target.checked)} className="mt-1 h-4 w-4" />
        <span><strong>Take bookings on your website.</strong> Clients can pick a time on your /book page.</span>
      </label>

      <fieldset className={s.enabled ? "" : "opacity-50 pointer-events-none"}>
        <legend className="text-sm font-medium mb-2">Weekly hours (your timezone)</legend>
        <div className="space-y-2">
          {DAYS.map(([day, label]) => (
            <div key={day} className="flex flex-wrap items-center gap-2">
              <span className="w-10 text-sm">{label}</span>
              {s.weekly[day].length === 0 ? <span className="text-xs text-muted">Closed</span> : null}
              {s.weekly[day].map((w, i) => (
                <span key={i} className="flex items-center gap-1">
                  <input type="time" value={w.start} onChange={(e) => setWindow(day, i, "start", e.target.value)} className="h-8 rounded border border-line-2 bg-surface px-1.5 text-sm" />
                  <span className="text-muted">–</span>
                  <input type="time" value={w.end} onChange={(e) => setWindow(day, i, "end", e.target.value)} className="h-8 rounded border border-line-2 bg-surface px-1.5 text-sm" />
                  <button type="button" onClick={() => removeWindow(day, i)} className="text-muted hover:text-danger text-xs">✕</button>
                </span>
              ))}
              <button type="button" onClick={() => addWindow(day)} className="text-xs text-brand hover:underline">+ hours</button>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2 max-w-lg">
        <NumField label="Buffer between sessions (min)" value={s.bufferMinutes} min={0} max={120} onChange={(v) => setField("bufferMinutes", v)} />
        <NumField label="Minimum notice (hours)" value={s.leadTimeHours} min={0} max={720} onChange={(v) => setField("leadTimeHours", v)} />
        <NumField label="Max sessions per day" value={s.maxPerDay} min={1} max={24} onChange={(v) => setField("maxPerDay", v)} />
        <NumField label="Slot step (min)" value={s.slotStepMinutes} min={5} max={120} onChange={(v) => setField("slotStepMinutes", v)} />
        <NumField label="Self reschedule/cancel until (hours before)" value={s.cancelWindowHours} min={0} max={720} onChange={(v) => setField("cancelWindowHours", v)} />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={s.depositRequired} onChange={(e) => setField("depositRequired", e.target.checked)} className="mt-1 h-4 w-4" />
        <span>Require a deposit to confirm a booking. When off, clients can book without paying.</span>
      </label>

      <label className="block max-w-lg">
        <span className="text-sm font-medium">Cancellation policy</span>
        <textarea value={s.policy} onChange={(e) => setField("policy", e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-line-2 bg-surface px-3 py-2 text-sm" />
      </label>

      <BlockedDates dates={s.blockedDates} onChange={(d) => setField("blockedDates", d)} />

      <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save booking settings"}</Button>
    </div>
  );
}

function NumField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="text-sm">
      <span className="font-medium">{label}</span>
      <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))} className="mt-1 w-full h-10 rounded-lg border border-line-2 bg-surface px-3" />
    </label>
  );
}

function BlockedDates({ dates, onChange }: { dates: string[]; onChange: (d: string[]) => void }) {
  const [pick, setPick] = useState("");
  return (
    <div className="max-w-lg">
      <span className="text-sm font-medium">Blocked dates (holidays)</span>
      <div className="mt-1 flex items-center gap-2">
        <input type="date" value={pick} onChange={(e) => setPick(e.target.value)} className="h-9 rounded-lg border border-line-2 bg-surface px-2 text-sm" />
        <button type="button" onClick={() => { if (pick && !dates.includes(pick)) { onChange([...dates, pick].sort()); setPick(""); } }} className="btn-secondary btn-sm">Block</button>
      </div>
      {dates.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {dates.map((d) => (
            <li key={d} className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs">
              {d}<button type="button" onClick={() => onChange(dates.filter((x) => x !== d))} className="text-muted hover:text-danger">✕</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
