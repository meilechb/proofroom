import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };

/** Profile settings arrive with plan item 17.2; this placeholder keeps the hub navigable. */
export default async function SettingsProfilePage() {
  const { studio } = await requireStudioPage("admin");
  return (
    <Card>
      <h2 className="font-medium">Profile</h2>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
        <div><dt className="text-muted">Studio</dt><dd>{studio.name}</dd></div>
        <div><dt className="text-muted">Address</dt><dd>{studio.slug}</dd></div>
        <div><dt className="text-muted">Email</dt><dd>{studio.email}</dd></div>
        <div><dt className="text-muted">Timezone</dt><dd>{studio.timezone}</dd></div>
      </dl>
      <p className="mt-4 text-sm text-muted">Editing arrives with the profile settings piece.</p>
    </Card>
  );
}
