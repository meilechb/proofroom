import type { Metadata } from "next";
import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { automationSettings, automationsPaused } from "@/lib/automations";
import { PageHeader, Card, Notice } from "@/components/ui";
import { AutomationsForm } from "./automations-form";

export const metadata: Metadata = { title: "Automations" };

/** Enable, time and pause the automatic client emails (plan 16.7, 16.10). */
export default async function AutomationsPage() {
  const ctx = await requireStudioPage("admin");
  const settings = (ctx.studio.settings ?? {}) as Record<string, unknown>;

  return (
    <div>
      <PageHeader
        eyebrow="Emails"
        title="Automations"
        description="Emails that send themselves at the right moment. Turn each on or off and set its timing; edit the wording under Emails."
        actions={<Link href="/studio/emails" className="btn-ghost btn-sm">Back to emails</Link>}
      />
      {!ctx.entitlements.automations ? (
        <Notice tone="warning" className="mb-4">
          Automations are part of Pro. Your settings are kept, but nothing sends on the Free plan. <Link href="/studio/billing" className="underline">Upgrade to turn them on</Link>.
        </Notice>
      ) : null}
      <Card>
        <AutomationsForm settings={automationSettings(settings)} paused={automationsPaused(settings)} />
      </Card>
    </div>
  );
}
