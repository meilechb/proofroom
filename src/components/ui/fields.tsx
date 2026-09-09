"use client";

import { useEffect, useId, useState, type ComponentProps } from "react";
import { cx, Input } from "@/components/ui";
import { contrastRatio } from "@/lib/site/theme";

/** ColorField (plan 4.16): hex input, swatches, and a contrast warning against white and black. */
export function ColorField({ name, label, defaultValue = "#111111", swatches = ["#111111", "#1f2937", "#b45309", "#0f766e", "#1d4ed8", "#9d174d", "#f5f5f4"], hint }: { name: string; label: string; defaultValue?: string; swatches?: string[]; hint?: string }) {
  const [value, setValue] = useState(defaultValue);
  const id = useId();
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  const onWhite = valid ? contrastRatio(value, "#ffffff") : 0;
  const onBlack = valid ? contrastRatio(value, "#000000") : 0;
  const warning = valid && onWhite < 3 && onBlack < 3 ? "Too faint against both light and dark backgrounds." : valid && onWhite < 3 ? "Hard to see on a light background." : valid && onBlack < 3 ? "Hard to see on a dark background." : null;
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} picker`} value={valid ? value : "#000000"} onChange={(e) => setValue(e.target.value)} className="h-10 w-12 rounded-lg border border-line-2 bg-surface p-1" />
        <Input id={id} name={name} value={value} onChange={(e) => setValue(e.target.value.trim())} pattern="^#[0-9a-fA-F]{6}$" className="font-mono w-32" aria-invalid={!valid} />
        <div className="flex gap-1">
          {swatches.map((s) => (
            <button key={s} type="button" aria-label={`Use ${s}`} onClick={() => setValue(s)} className={cx("h-7 w-7 rounded-full border", value.toLowerCase() === s.toLowerCase() ? "border-ink ring-2 ring-accent/30" : "border-line-2")} style={{ background: s }} />
          ))}
        </div>
      </div>
      {!valid ? <p className="field-error">Use a hex color like #1A2B3C.</p> : warning ? <p className="hint text-warning">{warning}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

/**
 * DateTimeField (plan 4.17): the studio picks local wall time; the form posts an
 * ISO string with the studio timezone's offset in a hidden input.
 */
export function DateTimeField({ name, label, timeZone, defaultValue, required, hint }: { name: string; label: string; timeZone: string; defaultValue?: string | null; required?: boolean; hint?: string }) {
  const id = useId();
  const [local, setLocal] = useState(() => (defaultValue ? toLocalInput(defaultValue, timeZone) : ""));
  const [iso, setIso] = useState(() => (defaultValue ? new Date(defaultValue).toISOString() : ""));
  useEffect(() => {
    setIso(local ? fromLocalInput(local, timeZone) : "");
  }, [local, timeZone]);
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <Input id={id} type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} required={required} step={300} />
      <input type="hidden" name={name} value={iso} />
      <p className="hint">{hint ?? `Times are in ${timeZone.replace(/_/g, " ")}.`}</p>
    </div>
  );
}

function tzOffsetMinutes(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Math.round((Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - at.getTime()) / 60000);
}

export function toLocalInput(iso: string, timeZone: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function fromLocalInput(local: string, timeZone: string) {
  const [date, time] = local.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let offset = tzOffsetMinutes(new Date(guess), timeZone);
  let result = new Date(guess - offset * 60000);
  const offset2 = tzOffsetMinutes(result, timeZone);
  if (offset2 !== offset) {
    offset = offset2;
    result = new Date(guess - offset * 60000);
  }
  return result.toISOString();
}

/** MoneyField (plan 4.18): shows dollars, posts cents in a hidden input. */
export function MoneyField({ name, label, defaultCents = 0, currency = "USD", required, hint, min = 0, ...rest }: Omit<ComponentProps<"input">, "name" | "defaultValue"> & { name: string; label: string; defaultCents?: number; currency?: string; hint?: string }) {
  const id = useId();
  const [text, setText] = useState((defaultCents / 100).toFixed(2));
  const cents = Math.round(Number(text.replace(/[^0-9.]/g, "")) * 100);
  const valid = Number.isFinite(cents) && cents >= Number(min) * 100;
  const symbol = new Intl.NumberFormat("en-US", { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")?.value ?? "$";
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <span className="absolute inset-y-0 left-3 flex items-center text-muted text-sm" aria-hidden>{symbol}</span>
        <Input id={id} inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => valid && setText((cents / 100).toFixed(2))} className="pl-7" required={required} aria-invalid={!valid} {...rest} />
      </div>
      <input type="hidden" name={name} value={valid ? cents : ""} />
      {!valid ? <p className="field-error">Enter an amount.</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}
