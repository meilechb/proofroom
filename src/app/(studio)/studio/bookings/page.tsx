import type { Metadata } from "next";
import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { db, rows } from "@/lib/db";
import { bookingSettings } from "@/lib/booking-shared";
import { bookingUrl } from "@/lib/tenant";
import { formatInZone, formatTimeInZone } from "@/lib/dates";
import { PageHeader, EmptyState, Badge, ButtonLink, Notice } from "@/components/ui";
import { Tabs } from "@/components/ui/tabs";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { setBookingStatusAction } from "./actions";

export const metadata: Metadata = { title: "Bookings" };

type Row = {
  id: string; starts_at: string; ends_at: string; status: "held" | "confirmed" | "cancelled" | "no_show" | "completed"; notes: string | null; created_at: string;
  client_id: string | null; client_name: string | null; client_email: string | null; package_name: string | null; order_id: string | null; order_number: number | null;
};

const TONE: Record<Row["status"], "neutral" | "success" | "warning" | "danger" | "info"> = { held: "warning", confirmed: "success", cancelled: "neutral", no_show: "danger", completed: "info" };
const LABEL: Record<Row["status"], string> = { held: "Held", confirmed: "Confirmed", cancelled: "Cancelled", no_show: "No-show", completed: "Completed" };

/** Website bookings: upcoming, past and cancelled, with outcomes (plan 21.13, 21.14). */
export default async function BookingsPage({ searchParams }: PageProps<"/studio/bookings">) {
  const ctx = await requireStudioPage();
  const sp = await searchParams;
  const tab = (["upcoming", "past", "cancelled"].includes(String(sp.tab)) ? sp.tab : "upcoming") as "upcoming" | "past" | "cancelled";
  const tz = ctx.studio.timezone;
  const settings = bookingSettings((ctx.studio.settings ?? {}) as Record<string, unknown>);
  const list = rows<Row>(
    await db()`
      select s.id, s.starts_at::text, s.ends_at::text, s.status, s.notes, s.created_at::text,
        c.id as client_id, c.name as client_name, c.email as client_email, p.name as package_name, o.id as order_id, o.order_number
      from booking_slots s
        left join clients c on c.id = s.client_id
        left join packages p on p.id = s.package_id
        left join orders o on o.id = s.order_id
      where s.studio_id = ${ctx.studio.id}
        and case ${tab}
          when 'upcoming' then s.status in ('confirmed', 'held') and s.ends_at >= now() and (s.status <> 'held' or s.hold_expires_at > now())
          when 'past' then s.status in ('confirmed', 'completed', 'no_show') and s.ends_at < now()
          else s.status = 'cancelled' end
      order by s.starts_at ${tab === "upcoming" ? db()`asc` : db()`desc`}
      limit 200`
  );

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Sessions clients booked from your website."
        actions={
          <>
            <ButtonLink href="/studio/calendar" variant="secondary">Calendar</ButtonLink>
            <ButtonLink href="/studio/settings/bookings" variant="secondary">Availability</ButtonLink>
          </>
        }
      />
      {!settings.enabled ? (
        <Notice tone="warning" className="mt-4">
          Online booking is off. Turn it on under <Link href="/studio/settings/bookings" className="underline">Settings → Bookings</Link> and enable the Book page under Website → Pages. Your booking link will be <span className="font-mono text-xs">{bookingUrl(ctx.studio)}</span>.
        </Notice>
      ) : null}
      <Tabs className="mt-4" items={[{ value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }, { value: "cancelled", label: "Cancelled" }]} />
      <div className="mt-4">
        {list.length === 0 ? (
          <EmptyState
            title={tab === "upcoming" ? "No upcoming bookings" : tab === "past" ? "No past bookings" : "No cancelled bookings"}
            description={tab === "upcoming" ? "When a client books a time on your website it shows up here and on the calendar." : undefined}
            action={tab === "upcoming" ? <ButtonLink href={bookingUrl(ctx.studio)} variant="secondary" target="_blank">Open your booking page</ButtonLink> : undefined}
          />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 border-b border-line font-medium">When</th>
                <th className="px-4 py-3 border-b border-line font-medium">Client</th>
                <th className="px-4 py-3 border-b border-line font-medium hidden sm:table-cell">Package</th>
                <th className="px-4 py-3 border-b border-line font-medium">Status</th>
                <th className="px-4 py-3 border-b border-line font-medium text-right">Actions</th>
              </tr></thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-3 border-b border-line whitespace-nowrap">
                      <div className="font-medium">{formatInZone(b.starts_at, tz, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>
                      <div className="text-xs text-ink-2">{formatTimeInZone(b.starts_at, tz)} – {formatTimeInZone(b.ends_at, tz)}</div>
                    </td>
                    <td className="px-4 py-3 border-b border-line">
                      {b.client_id ? <Link href={`/studio/clients/${b.client_id}`} className="font-medium hover:underline">{b.client_name}</Link> : <span className="text-ink-2">Not confirmed yet</span>}
                      {b.client_email ? <div className="text-xs text-ink-2">{b.client_email}</div> : null}
                      {b.order_id ? <Link href={`/studio/sessions/${b.order_id}`} className="text-xs underline text-ink-2">Session #{b.order_number}</Link> : null}
                    </td>
                    <td className="px-4 py-3 border-b border-line hidden sm:table-cell">{b.package_name ?? "—"}{b.notes ? <div className="text-xs text-ink-2 truncate max-w-xs" title={b.notes}>{b.notes}</div> : null}</td>
                    <td className="px-4 py-3 border-b border-line"><Badge tone={TONE[b.status]}>{LABEL[b.status]}</Badge></td>
                    <td className="px-4 py-3 border-b border-line text-right">
                      {b.status === "confirmed" || b.status === "held" ? (
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          {new Date(b.ends_at) < new Date() ? (
                            <>
                              <form action={setBookingStatusAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value="completed" /><button className="btn-secondary btn-sm">Mark complete</button></form>
                              <form action={setBookingStatusAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value="no_show" /><ConfirmButton variant="secondary" size="sm" confirm="Mark this booking as a no-show?">No-show</ConfirmButton></form>
                            </>
                          ) : (
                            <form action={setBookingStatusAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value="cancelled" /><ConfirmButton variant="secondary" size="sm" confirm="Cancel this booking? The time opens up again on your booking page.">Cancel</ConfirmButton></form>
                          )}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
