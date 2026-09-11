import type { Metadata } from "next";
import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { listBookingRequests, upcomingBookings, bookingCounts, bookingSettings } from "@/lib/booking";
import { formatDate } from "@/lib/types";
import { PageHeader, Stat, Table, Th, Td, Badge, EmptyState, Notice, ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Bookings" };

/** Booking requests from the site and upcoming confirmed sessions (plan 21.16). */
export default async function BookingsPage() {
  const ctx = await requireStudioPage();
  const settings = bookingSettings((ctx.studio.settings ?? {}) as Record<string, unknown>);
  const [requests, upcoming, counts] = await Promise.all([
    listBookingRequests(ctx.studio.id),
    upcomingBookings(ctx.studio.id),
    bookingCounts(ctx.studio.id),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Scheduling"
        title="Bookings"
        description="Requests from your booking page and the sessions clients have booked."
        actions={<ButtonLink href="/studio/settings/bookings" variant="secondary">Availability</ButtonLink>}
      />

      {!settings.enabled ? (
        <Notice tone="warning" className="mb-6">
          Online booking is off, so clients can&apos;t book from your website yet.{" "}
          <Link href="/studio/settings/bookings" className="font-medium underline">Set your availability</Link> to turn it on.
        </Notice>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Stat label="Booking requests" value={counts.requests} hint="From your website" />
        <Stat label="Upcoming" value={counts.upcoming} hint="Confirmed sessions" />
        <Stat label="Held" value={counts.held} hint="Awaiting confirmation" />
      </div>

      <section className="mb-10">
        <h2 className="text-xl font-normal mb-3">Upcoming bookings</h2>
        {upcoming.length === 0 ? (
          <EmptyState title="No upcoming bookings" description="Confirmed sessions from your booking page show up here with their date and client." />
        ) : (
          <Table>
            <thead>
              <tr><Th>When</Th><Th>Client</Th><Th>Session</Th><Th className="hidden sm:table-cell">Package</Th><Th /></tr>
            </thead>
            <tbody>
              {upcoming.map((b) => (
                <tr key={b.id}>
                  <Td className="font-medium">{formatDate(b.starts_at, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</Td>
                  <Td>{b.client_name ?? "—"}</Td>
                  <Td className="text-ink-2">{b.order_title ?? "—"}</Td>
                  <Td className="hidden sm:table-cell text-ink-2">{b.package_name ?? "—"}</Td>
                  <Td className="text-right">{b.order_number ? <Link href={`/studio/sessions/${b.order_number}`} className="text-brand font-medium hover:underline">Open</Link> : null}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="text-xl font-normal mb-3">Booking requests</h2>
        {requests.length === 0 ? (
          <EmptyState title="No booking requests yet" description="When someone requests a session from your booking page, it appears here and in your inbox." action={<ButtonLink href="/studio/inbox" variant="secondary">Go to inbox</ButtonLink>} />
        ) : (
          <Table>
            <thead>
              <tr><Th>Contact</Th><Th className="hidden md:table-cell">Package</Th><Th className="hidden sm:table-cell">Group</Th><Th className="hidden lg:table-cell">Preferred</Th><Th>When</Th></tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <div className="font-medium">{r.name ?? "Someone"}</div>
                    <div className="text-xs text-muted">{r.email ?? ""}</div>
                    {r.inquiry_status === "new" ? <Badge tone="info" className="mt-1">New</Badge> : null}
                  </Td>
                  <Td className="hidden md:table-cell text-ink-2">{r.package_name ?? "—"}</Td>
                  <Td className="hidden sm:table-cell text-ink-2">{r.people_count ? `${r.people_count}` : "—"}</Td>
                  <Td className="hidden lg:table-cell text-ink-2">{r.preferred_dates || "—"}</Td>
                  <Td className="text-ink-2 whitespace-nowrap">{formatDate(r.created_at, { month: "short", day: "numeric" })}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
