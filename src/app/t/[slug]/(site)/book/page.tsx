import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { loadSiteData, assetUrl } from "@/lib/site/render";
import { bookingSettings, openWeekdays, overrideDates, localDateISO, addDaysISO, BOOKING_HORIZON_DAYS } from "@/lib/booking-shared";
import { canTakeCardPayments } from "@/lib/connect";
import { billingState } from "@/lib/plans";
import { PageHero, Container } from "@/components/site/sections";
import { BookingFlow } from "./booking-flow";

export async function generateMetadata({ params }: PageProps<"/t/[slug]/book">): Promise<Metadata> {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) return {};
  const { site } = await loadSiteData(studio);
  const p = site.seo.pages.book;
  return { title: p?.title || `Book a session | ${studio.name}`, description: p?.description || undefined, robots: { index: true } };
}

export default async function BookPage({ params }: PageProps<"/t/[slug]/book">) {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const data = await loadSiteData(studio);
  const page = data.site.book;
  const settings = bookingSettings((studio.settings ?? {}) as Record<string, unknown>);
  if (!page.enabled || !settings.enabled) notFound();

  const live = billingState(studio).publicLive;
  const tz = studio.timezone || "UTC";
  const packages = data.packages.filter((p) => p.is_active && p.bookable).map((p) => ({ id: p.id, name: p.name, description: p.description, price_cents: p.price_cents, deposit_cents: p.deposit_cents, duration_minutes: p.duration_minutes }));
  const now = new Date();
  const todayISO = localDateISO(now, tz);
  const minDateISO = localDateISO(new Date(now.getTime() + settings.leadTimeHours * 3600000), tz);
  const maxDateISO = addDaysISO(todayISO, BOOKING_HORIZON_DAYS);
  const ov = overrideDates(settings);

  return (
    <>
      <PageHero heading={page.heading || "Book a session"} subheading={page.body} res={assetUrl(data.assets, undefined, "full")} />
      <Container className="py-14 max-w-3xl">
        {!live ? (
          <p className="rounded-xl border border-[var(--site-line)] p-6 text-[var(--site-ink-2)]">Online booking is paused right now. Please use the contact page to get in touch.</p>
        ) : packages.length === 0 ? (
          <p className="rounded-xl border border-[var(--site-line)] p-6 text-[var(--site-ink-2)]">No sessions are open for booking at the moment. Please check back soon or reach out through the contact page.</p>
        ) : (
          <BookingFlow
            slug={slug}
            packages={packages}
            currency={studio.currency}
            timezone={tz}
            minDateISO={minDateISO}
            maxDateISO={maxDateISO}
            openWeekdays={openWeekdays(settings)}
            blockedDates={[...settings.blockedDates, ...ov.closed]}
            extraOpenDates={ov.open}
            depositRequired={settings.depositRequired}
            canPayNow={canTakeCardPayments(studio)}
            policy={settings.policy}
          />
        )}
      </Container>
    </>
  );
}
