import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { audienceCount, listBroadcasts } from "@/lib/broadcasts";
import { formatDate } from "@/lib/types";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { UpgradeLock } from "@/components/studio/upgrade-lock";
import { BroadcastDialog } from "./broadcast-dialog";
import { SendForm } from "./send-form";
import { cancelBroadcastAction, deleteBroadcastAction } from "./actions";

export const metadata = { title: "Broadcasts" };

export default async function BroadcastsPage() {
  const ctx = await requireStudioPage("admin");
  if (!ctx.entitlements.automations) {
    return (
      <>
        <PageHeader title="Broadcasts" description="Email your buyers and clients." />
        <UpgradeLock title="Broadcasts">Send a one-off email to everyone who has bought from you, or to all your clients — with unsubscribes handled for you.</UpgradeLock>
      </>
    );
  }

  const [broadcasts, buyers, clients] = await Promise.all([
    listBroadcasts(ctx.studio.id),
    audienceCount(ctx.studio.id, "buyers"),
    audienceCount(ctx.studio.id, "clients"),
  ]);
  const counts = { buyers, clients };

  return (
    <>
      <PageHeader
        title="Broadcasts"
        description="A one-off email to your buyers or clients. Unsubscribes and suppressions are always respected."
        actions={
          <div className="flex gap-2">
            <Link href="/studio/emails" className="btn-ghost btn-sm">Emails</Link>
            <BroadcastDialog trigger="add" counts={counts} />
          </div>
        }
      />
      {broadcasts.length === 0 ? (
        <EmptyState title="No broadcasts yet" description="Write a message to your buyers or clients — announce new work, a sale, or a seasonal offer." action={<BroadcastDialog trigger="add" counts={counts} />} />
      ) : (
        <ul className="space-y-3">
          {broadcasts.map((b) => (
            <li key={b.id} className="card card-pad">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium truncate">{b.subject}</h2>
                    <Badge tone={b.status === "sent" ? "brand" : b.status === "cancelled" ? "neutral" : "info"}>{b.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {b.filter?.audience === "clients" ? "All clients" : "Store buyers"}
                    {b.status === "sending" || b.status === "sent" ? ` · ${b.sent_count}/${b.recipient_count} sent` : b.recipient_count ? ` · ${b.recipient_count} recipients` : ""}
                    {b.status === "scheduled" && b.scheduled_at ? ` · scheduled ${formatDate(b.scheduled_at)}` : ""}
                    {b.status === "sent" && b.sent_at ? ` · ${formatDate(b.sent_at)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {b.status === "draft" ? (
                    <>
                      <BroadcastDialog broadcast={b} trigger="edit" counts={counts} />
                      <form action={deleteBroadcastAction}><input type="hidden" name="id" value={b.id} /><button className="text-xs text-muted hover:text-danger">Delete</button></form>
                    </>
                  ) : null}
                  {b.status === "scheduled" ? (
                    <form action={cancelBroadcastAction}><input type="hidden" name="id" value={b.id} /><button className="text-xs text-muted hover:text-danger">Cancel</button></form>
                  ) : null}
                </div>
              </div>
              {b.status === "draft" ? <SendForm id={b.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
