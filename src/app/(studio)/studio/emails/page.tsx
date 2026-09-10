import type { Metadata } from "next";
import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { emailTemplates } from "@/lib/email-templates";
import { listTemplateOverrides } from "@/lib/email-templates-server";
import { senderFor } from "@/lib/email";
import { PageHeader, Card, Badge } from "@/components/ui";
import { SenderForm } from "./sender-form";

export const metadata: Metadata = { title: "Emails" };

/** Email templates and sender identity (plan 16.1, 16.3). */
export default async function EmailsPage() {
  const ctx = await requireStudioPage("admin");
  const [overrides, sender] = await Promise.all([
    listTemplateOverrides(ctx.studio.id),
    senderFor({ id: ctx.studio.id, name: ctx.studio.name, email: ctx.studio.email }),
  ]);

  return (
    <div>
      <PageHeader title="Emails" description="The messages your clients receive. Personalize the wording; the timing and recipients stay automatic." actions={<div className="flex gap-2"><Link href="/studio/emails/suppressions" className="btn-ghost btn-sm">Suppressed</Link><Link href="/studio/emails/log" className="btn-secondary btn-sm">Email log</Link></div>} />

      <Card className="mb-6">
        <h2 className="font-medium mb-3">Sender</h2>
        <SenderForm fromName={sender.fromName} replyTo={sender.replyTo} fromAddress={sender.fromAddress} />
      </Card>

      <div className="space-y-2">
        {emailTemplates.map((t) => {
          const o = overrides.get(t.key);
          return (
            <Link key={t.key} href={`/studio/emails/${t.key}`} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 hover:border-line-2">
              <div className="min-w-0">
                <p className="font-medium text-sm flex items-center gap-2">{t.name}{o ? <Badge tone="brand">Customized</Badge> : null}{t.automation ? <Badge>Automatic</Badge> : null}</p>
                <p className="text-xs text-ink-2 truncate">{t.when}</p>
              </div>
              <span className="text-xs text-muted whitespace-nowrap">{o ? `Edited ${new Date(o.updated_at).toLocaleDateString()}` : "Default"} ›</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
