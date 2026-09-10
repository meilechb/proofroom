import type { Metadata } from "next";
import { requirePlatformAdminPage } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/admin";
import { sendingDomainUsage } from "@/lib/platform-digest";
import { Card, Notice, Meter } from "@/components/ui";
import { PlatformSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings · Admin" };

export default async function AdminSettingsPage() {
  await requirePlatformAdminPage();
  const [settings, domains] = await Promise.all([getPlatformSettings(), sendingDomainUsage()]);
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Platform settings</h1>
      <Card>
        <PlatformSettingsForm settings={settings} />
      </Card>
      <Card>
        <h2 className="font-medium mb-2">Sending domains</h2>
        <p className="text-sm text-ink-2 mb-3">Studio sending domains registered with Resend, against your plan limit.</p>
        <Meter value={domains.used} max={domains.limit} label={`${domains.used} of ${domains.limit} domains`} />
        {domains.warn ? <Notice tone="warning" className="mt-3">You are at {Math.round((domains.used / domains.limit) * 100)}% of your Resend domain limit. Upgrade the plan or add the domain add-on before it fills.</Notice> : null}
      </Card>
    </div>
  );
}
