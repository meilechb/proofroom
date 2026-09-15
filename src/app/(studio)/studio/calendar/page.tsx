import type { Metadata } from "next";
import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { calendarFeedUrl, calendarItems, type StudioCalendarItem } from "@/lib/calendar";
import { zonedTime, bookingSettings, overrideDates } from "@/lib/booking-shared";
import { dateISOInZone, formatTimeInZone } from "@/lib/dates";
import { PageHeader, Card, ButtonLink, cx } from "@/components/ui";
import { CopyButton } from "@/components/forms/copy-button";

export const metadata: Metadata = { title: "Calendar" };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function shift(year: number, month: number, by: number) {
  const d = new Date(Date.UTC(year, month - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Month view of sessions and bookings in the studio's timezone (plan 3.63). */
export default async function CalendarPage({ searchParams }: PageProps<"/studio/calendar">) {
  const ctx = await requireStudioPage();
  const sp = await searchParams;
  const tz = ctx.studio.timezone;
  const todayISO = dateISOInZone(new Date(), tz);
  const m = typeof sp.m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m) ? sp.m : todayISO.slice(0, 7);
  const [year, month] = m.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  // Query a little wider than the month so events on the boundary days show.
  const from = zonedTime(`${m}-01`, "00:00", tz);
  const to = zonedTime(`${shift(year, month, 1)}-01`, "00:00", tz);
  const items = await calendarItems(ctx.studio.id, new Date(from.getTime() - 86400000), new Date(to.getTime() + 86400000));
  const byDay = new Map<string, StudioCalendarItem[]>();
  for (const it of items) {
    const key = dateISOInZone(it.starts_at, tz);
    byDay.set(key, [...(byDay.get(key) ?? []), it]);
  }
  const cells: Array<{ iso: string; day: number } | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ iso: `${m}-${String(d).padStart(2, "0")}`, day: d });
  while (cells.length % 7 !== 0) cells.push(null);
  const upcoming = items.filter((i) => new Date(i.starts_at) >= new Date()).slice(0, 8);
  const bookingConf = bookingSettings((ctx.studio.settings ?? {}) as Record<string, unknown>);
  const closed = new Set<string>([...bookingConf.blockedDates, ...overrideDates(bookingConf).closed]);

  return (
    <>
      <PageHeader
        title="Calendar"
        description={`Sessions and website bookings, shown in ${tz}.`}
        actions={
          <>
            <ButtonLink href="/studio/bookings" variant="secondary">Bookings</ButtonLink>
            <ButtonLink href="/studio/sessions?new=1">New session</ButtonLink>
          </>
        }
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card pad={false}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <Link href={`/studio/calendar?m=${shift(year, month, -1)}`} className="btn-secondary btn-sm" aria-label="Previous month">‹</Link>
            <div className="flex items-center gap-3">
              <h2 className="font-medium">{monthLabel(year, month)}</h2>
              {m !== todayISO.slice(0, 7) ? <Link href="/studio/calendar" className="text-xs underline text-ink-2">Today</Link> : null}
            </div>
            <Link href={`/studio/calendar?m=${shift(year, month, 1)}`} className="btn-secondary btn-sm" aria-label="Next month">›</Link>
          </div>
          <div className="grid grid-cols-7 text-xs uppercase tracking-wide text-muted border-b border-line">
            {WEEKDAYS.map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => (
              <div key={i} className={cx("min-h-24 border-b border-r border-line p-1.5 text-xs", (i + 1) % 7 === 0 && "border-r-0", (!cell || closed.has(cell.iso)) && "bg-surface-2/40")} title={cell && closed.has(cell.iso) ? "Closed for bookings" : undefined}>
                {cell ? (
                  <>
                    <div className={cx("mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full", cell.iso === todayISO ? "bg-ink text-white font-medium" : "text-ink-2")}>{cell.day}</div>
                    <ul className="space-y-1">
                      {(byDay.get(cell.iso) ?? []).map((it) => (
                        <li key={`${it.kind}-${it.id}`}>
                          <Link
                            href={it.order_id ? `/studio/sessions/${it.order_id}` : "/studio/bookings"}
                            title={`${formatTimeInZone(it.starts_at, tz)} · ${it.title}${it.client_name ? ` · ${it.client_name}` : ""}`}
                            className={cx("block truncate rounded px-1.5 py-0.5", it.kind === "session" ? "bg-brand/10 text-ink hover:bg-brand/20" : it.kind === "booking" ? "bg-success-bg text-success-fg" : "bg-warning-bg text-warning-fg")}
                          >
                            <span className="font-medium">{formatTimeInZone(it.starts_at, tz)}</span> {it.client_name ?? it.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <h2 className="font-medium mb-2">Coming up</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-ink-2">Nothing scheduled this month. <Link href="/studio/sessions?new=1" className="underline">Schedule a session</Link>.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {upcoming.map((it) => (
                  <li key={`${it.kind}-${it.id}`} className="py-2">
                    <Link href={it.order_id ? `/studio/sessions/${it.order_id}` : "/studio/bookings"} className="font-medium hover:underline">{it.title}</Link>
                    <div className="text-xs text-ink-2">{new Date(it.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz })} · {formatTimeInZone(it.starts_at, tz)}{it.client_name ? ` · ${it.client_name}` : ""}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="font-medium mb-1">Subscribe from your calendar app</h2>
            <p className="text-sm text-ink-2">Add this address in Google Calendar, Apple Calendar or Outlook to see sessions and bookings alongside everything else. Anyone with the link can read your schedule, so treat it like a password.</p>
            <div className="mt-3 flex items-center gap-2">
              <input readOnly value={calendarFeedUrl(ctx.studio)} className="input text-xs flex-1 min-w-0" aria-label="Calendar feed URL" onFocus={undefined} />
              <CopyButton value={calendarFeedUrl(ctx.studio)} />
            </div>
          </Card>
          <Card>
            <h2 className="font-medium mb-2">Legend</h2>
            <ul className="text-sm space-y-1.5">
              <li className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-brand/30" /> Session</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-success-bg border border-success/30" /> Website booking</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-warning-bg border border-warning/30" /> Hold (expires in minutes)</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-surface-2 border border-line" /> Closed for bookings</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
