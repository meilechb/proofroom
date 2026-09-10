import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { bookingSettings } from "@/lib/booking-shared";
import { Card } from "@/components/ui";
import { BookingsForm } from "./bookings-form";

export const metadata: Metadata = { title: "Bookings" };

/** Booking availability settings (plan 21.9). */
export default async function BookingsSettingsPage() {
  const ctx = await requireStudioPage("admin");
  const settings = bookingSettings((ctx.studio.settings ?? {}) as Record<string, unknown>);
  return (
    <Card>
      <h2 className="font-medium mb-1">Bookings</h2>
      <p className="text-sm text-ink-2 mb-4">Let clients book a session from your website. Turn on the Book page under Website → Pages.</p>
      <BookingsForm initial={settings} />
    </Card>
  );
}
