import type { Metadata } from "next";
import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { listEmailLog } from "@/lib/email-events";
import { templateKeys } from "@/lib/email-templates";
import { PageHeader, EmptyState } from "@/components/ui";
import { SearchInput } from "@/components/ui/search-input";
import { EmailLogTable, type LogRow } from "./email-log-table";
import { LogFilters } from "./log-filters";

export const metadata: Metadata = { title: "Email log" };

/** Every email sent, with delivery status and resend (plan 16.4). */
export default async function EmailLogPage({ searchParams }: PageProps<"/studio/emails/log">) {
  const ctx = await requireStudioPage("admin");
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const template = typeof sp.template === "string" ? sp.template : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const entries = await listEmailLog(ctx.studio.id, { status, template, q });
  const rows: LogRow[] = entries.map((e) => ({
    id: e.id, to_address: e.to_address, subject: e.subject, status: e.status, template_key: e.template_key, last_event: e.last_event, created_at: e.created_at,
    delivered_at: e.delivered_at, opened_at: e.opened_at, clicked_at: e.clicked_at, bounced_at: e.bounced_at, complained_at: e.complained_at,
  }));

  return (
    <div>
      <PageHeader eyebrow="Emails" title="Email log" description="Every email your studio sent and what happened to it." actions={<Link href="/studio/emails" className="btn-ghost btn-sm">Back to emails</Link>} />
      <div className="mb-4 flex flex-wrap items-center gap-2 justify-between">
        <SearchInput placeholder="Search by recipient or subject" className="w-full sm:w-80" />
        <LogFilters templates={[...templateKeys]} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No emails yet" description="Emails you send to clients will appear here with their delivery status." />
      ) : (
        <EmailLogTable rows={rows} />
      )}
    </div>
  );
}
