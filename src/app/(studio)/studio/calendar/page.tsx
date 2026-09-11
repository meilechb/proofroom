import type { Metadata } from "next";
import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import {
  calendarShoots, calendarHolds, bookingSettings, zonedTime, localDateISO, weekdayOfISO, overrideDates,
  type CalShoot, type CalHold,
} from "@/lib/booking";
import { formatDate } from "@/lib/types";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Calendar" };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Month grid of shoots, holds and blocked days (plan 21.17). */
export default async function CalendarPage({ searchParams }: PageProps<"/studio/calendar">) {
  const ctx = await requireStudioPage();
  const sp = await searchParams;
  const tz = ctx.studio.timezone || "UTC";
  const settings = bookingSettings((ctx.studio.settings ?? {}) as Record<string, unknown>);

  const todayISO = localDateISO(new Date(), tz);
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : todayISO.slice(0, 7);
  const [y, m] = month.split("-").map(Number); // m: 1..12

  const firstISO = `${month}-01`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const leading = weekdayOfISO(firstISO);
  const from = zonedTime(firstISO, "00:00", tz);
  const nextFirst = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const to = zonedTime(nextFirst, "00:00", tz);

  const [shoots, holds] = await Promise.all([calendarShoots(ctx.studio.id, from, to), calendarHolds(ctx.studio.id, from, to)]);

  const byDate: Record<string, { shoots: CalShoot[]; holds: CalHold[] }> = {};
  const bucket = (d: string) => (byDate[d] ??= { shoots: [], holds: [] });
  for (const s of shoots) bucket(localDateISO(new Date(s.scheduled_at), tz)).shoots.push(s);
  for (const h of holds) bucket(localDateISO(new Date(h.starts_at), tz)).holds.push(h);
  const closed = new Set<string>([...settings.blockedDates, ...overrideDates(settings).closed]);

  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const cells: Array<{ iso: string; day: number } | null> = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ iso: `${month}-${String(d).padStart(2, "0")}`, day: d });
  const time = (v: string) => formatDate(v, { hour: "numeric", minute: "2-digit", timeZone: tz });

  return (
    <div>
      <PageHeader eyebrow="Scheduling" title="Calendar" description="Your shoots, tentative holds and blocked days at a glance." />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Link href={`/studio/calendar?month=${prev}`} className="btn-secondary btn-sm" aria-label="Previous month">←</Link>
          <h2 className="text-xl font-normal min-w-44 text-center">{monthLabel}</h2>
          <Link href={`/studio/calendar?month=${next}`} className="btn-secondary btn-sm" aria-label="Next month">→</Link>
          <Link href="/studio/calendar" className="btn-ghost btn-sm">Today</Link>
        </div>
        <div className="flex items-center gap-4 text-xs text-ink-2">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-info" />Shoot</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning" />Hold</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-line-2" />Blocked</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 border-l border-t border-line rounded-t-xl overflow-hidden">
            {WEEKDAYS.map((w) => (
              <div key={w} className="border-r border-b border-line bg-surface-2 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted text-center">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 border-l border-line">
            {cells.map((cell, i) => {
              if (!cell) return <div key={`b${i}`} className="border-r border-b border-line bg-surface-2/40 min-h-28" />;
              const ev = byDate[cell.iso];
              const isToday = cell.iso === todayISO;
              const blocked = closed.has(cell.iso);
              return (
                <div key={cell.iso} className={`relative border-r border-b border-line min-h-28 p-1.5 ${blocked ? "bg-surface-2/70" : "bg-surface"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs ${isToday ? "bg-brand text-brand-ink font-semibold" : "text-ink-2"}`}>{cell.day}</span>
                    {blocked ? <span className="text-[10px] uppercase tracking-wide text-muted">Blocked</span> : null}
                  </div>
                  <div className="mt-1 space-y-1">
                    {ev?.shoots.map((s) => (
                      <Link key={s.id} href={`/studio/sessions/${s.order_number}`} title={`${time(s.scheduled_at)} · ${s.title}${s.client_name ? ` · ${s.client_name}` : ""}`}
                        className="block truncate rounded-md bg-info-bg px-1.5 py-0.5 text-[11px] font-medium text-info-fg hover:brightness-95">
                        {time(s.scheduled_at)} {s.title}
                      </Link>
                    ))}
                    {ev?.holds.map((h) => (
                      <div key={h.id} title={`Tentative hold at ${time(h.starts_at)}`} className="truncate rounded-md bg-warning-bg px-1.5 py-0.5 text-[11px] font-medium text-warning-fg">
                        {time(h.starts_at)} Hold
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm text-ink-2">
        Shoots come from scheduled sessions. Holds are tentative bookings awaiting confirmation. Set blocked days and hours under{" "}
        <Link href="/studio/settings/bookings" className="text-brand font-medium hover:underline">Availability</Link>.
      </p>
    </div>
  );
}
