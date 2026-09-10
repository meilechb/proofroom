import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { Card } from "@/components/ui";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Settings" };

/** Studio profile (plan 17.2). */
export default async function SettingsProfilePage() {
  const { studio } = await requireStudioPage("admin");
  const settings = (studio.settings ?? {}) as Record<string, unknown>;
  return (
    <Card>
      <h2 className="font-medium mb-4">Profile</h2>
      <ProfileForm
        values={{
          name: studio.name,
          legal_name: studio.legal_name ?? "",
          email: studio.email,
          phone: studio.phone ?? "",
          timezone: studio.timezone,
          currency: studio.currency,
          address: typeof settings.address === "string" ? settings.address : "",
          business_hours: typeof settings.business_hours === "string" ? settings.business_hours : "",
        }}
      />
    </Card>
  );
}
