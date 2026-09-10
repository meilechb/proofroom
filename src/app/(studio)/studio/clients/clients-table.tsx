import Link from "next/link";
import type { Client } from "@/lib/types";
import { clientStageLabels } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/types";
import { cx } from "@/components/ui";

const STAGE_TONE: Record<string, string> = {
  lead: "badge-warning",
  awaiting_payment: "badge-danger",
  booked: "badge-brand",
  proofing: "badge-neutral",
  delivered: "badge-success",
  archived: "badge-neutral",
};

export function StageBadge({ stage }: { stage: string }) {
  return <span className={cx(STAGE_TONE[stage] ?? "badge-neutral")}>{clientStageLabels[stage as keyof typeof clientStageLabels] ?? stage}</span>;
}

/** Server-rendered rows for the clients list (plan 10.7). */
export function ClientRows({ clients }: { clients: Array<Client & { balance_due_cents: number }> }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 border-b border-line font-medium">Name</th>
            <th className="px-4 py-3 border-b border-line font-medium">Stage</th>
            <th className="px-4 py-3 border-b border-line font-medium hidden sm:table-cell">Company</th>
            <th className="px-4 py-3 border-b border-line font-medium hidden md:table-cell">Last activity</th>
            <th className="px-4 py-3 border-b border-line font-medium text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id} className="hover:bg-surface-2/60">
              <td className="px-4 py-3 border-b border-line">
                <Link href={`/studio/clients/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                <div className="text-xs text-muted">{c.email}</div>
                {c.tags.length ? <div className="mt-1 flex flex-wrap gap-1">{c.tags.slice(0, 4).map((t) => <span key={t} className="badge-neutral">{t}</span>)}</div> : null}
              </td>
              <td className="px-4 py-3 border-b border-line"><StageBadge stage={c.stage} /></td>
              <td className="px-4 py-3 border-b border-line hidden sm:table-cell text-ink-2">{c.company ?? "—"}</td>
              <td className="px-4 py-3 border-b border-line hidden md:table-cell text-ink-2">{c.last_activity_at ? formatDate(c.last_activity_at) : "—"}</td>
              <td className="px-4 py-3 border-b border-line text-right">{c.balance_due_cents > 0 ? <span className="font-medium text-danger">{formatMoney(c.balance_due_cents)}</span> : <span className="text-muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
