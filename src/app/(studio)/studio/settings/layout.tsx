import { Suspense } from "react";
import { requireStudioPage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "./tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireStudioPage("admin");
  return (
    <div>
      <PageHeader title="Settings" description="How your studio looks, gets paid, sends email and works with your team." />
      <Suspense fallback={null}><SettingsTabs /></Suspense>
      <div className="mt-6">{children}</div>
    </div>
  );
}
