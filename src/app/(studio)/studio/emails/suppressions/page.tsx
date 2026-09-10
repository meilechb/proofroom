import type { Metadata } from "next";
import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { listSuppressions } from "@/lib/suppressions";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { AddSuppressionForm } from "./add-form";
import { removeSuppressionAction } from "./actions";

export const metadata: Metadata = { title: "Suppressed addresses" };

const REASON_LABEL: Record<string, string> = { bounce: "Bounced", complaint: "Marked spam", manual: "Added by you", unsubscribe: "Unsubscribed" };

/** Addresses that never receive this studio's email (plan 16.6). */
export default async function SuppressionsPage() {
  const ctx = await requireStudioPage("admin");
  const list = await listSuppressions(ctx.studio.id);

  return (
    <div>
      <PageHeader eyebrow="Emails" title="Suppressed addresses" description="These addresses never receive your emails. Bounces and spam complaints are added automatically." actions={<Link href="/studio/emails" className="btn-ghost btn-sm">Back to emails</Link>} />

      <Card className="mb-6">
        <h2 className="font-medium mb-2">Add an address</h2>
        <AddSuppressionForm />
      </Card>

      {list.length === 0 ? (
        <EmptyState title="No suppressed addresses" description="Addresses that bounce or report your email as spam will appear here." />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {list.map((s) => (
            <li key={s.email} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm truncate">{s.email}</p>
                <p className="text-xs text-muted">{new Date(s.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={s.reason === "bounce" || s.reason === "complaint" ? "danger" : "neutral"}>{REASON_LABEL[s.reason] ?? s.reason}</Badge>
                <form action={removeSuppressionAction}>
                  <input type="hidden" name="email" value={s.email} />
                  <button className="text-xs text-muted hover:text-ink">Remove</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
