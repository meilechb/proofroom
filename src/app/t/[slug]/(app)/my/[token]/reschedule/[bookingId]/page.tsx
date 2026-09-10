import Link from "next/link";
import { notFound } from "next/navigation";
import { db, one, isUuid } from "@/lib/db";
import { studioBySlug } from "@/lib/tenant-data";
import { verifyLink } from "@/lib/tenant-tokens";
import { bookingSettings, openWeekdays, overrideDates, withinChangeWindow, localDateISO, addDaysISO, BOOKING_HORIZON_DAYS } from "@/lib/booking-shared";
import { formatDate } from "@/lib/types";
import { RescheduleFlow } from "./reschedule-flow";

export const metadata = { robots: { index: false, follow: false } };

export default async function ReschedulePage({ params }: PageProps<"/t/[slug]/my/[token]/reschedule/[bookingId]">) {
  const { slug, token, bookingId } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const clientId = verifyLink("hub", token);
  if (!clientId || !isUuid(bookingId)) notFound();
  const booking = one<{ id: string; starts_at: string; status: string }>(
    await db()`select id, starts_at, status from booking_slots where id = ${bookingId} and studio_id = ${studio.id} and client_id = ${clientId} and status = 'confirmed' and starts_at >= now() limit 1`
  );
  if (!booking) notFound();

  const settings = bookingSettings((studio.settings ?? {}) as Record<string, unknown>);
  const canChange = settings.enabled && withinChangeWindow(new Date(booking.starts_at), settings.cancelWindowHours);
  const tz = studio.timezone || "UTC";
  const now = new Date();
  const todayISO = localDateISO(now, tz);
  const minDateISO = localDateISO(new Date(now.getTime() + settings.leadTimeHours * 3600000), tz);
  const maxDateISO = addDaysISO(todayISO, BOOKING_HORIZON_DAYS);
  const currentLabel = formatDate(booking.starts_at, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  const ov = overrideDates(settings);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 sm:px-8 py-10">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>Reschedule your session</h1>
      {canChange ? (
        <div className="mt-6">
          <RescheduleFlow slug={slug} token={token} bookingId={bookingId} currentLabel={currentLabel} minDateISO={minDateISO} maxDateISO={maxDateISO} openWeekdays={openWeekdays(settings)} blockedDates={[...settings.blockedDates, ...ov.closed]} extraOpenDates={ov.open} />
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-[var(--site-line)] p-6 text-[var(--site-ink-2)]">
          <p>This session is within {settings.cancelWindowHours} hours and can no longer be changed online. Please contact {studio.name} at <a href={`mailto:${studio.email}`} className="underline">{studio.email}</a>.</p>
          <Link href={`/my/${token}`} className="mt-4 inline-block underline">Back to your portal</Link>
        </div>
      )}
    </div>
  );
}
