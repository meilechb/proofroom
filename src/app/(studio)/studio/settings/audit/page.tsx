import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { listAuditLog, auditFacets } from "@/lib/audit";
import { Card, EmptyState, Table, Th, Td } from "@/components/ui";
import { AuditFilters } from "./filters";

export const metadata: Metadata = { title: "Activity log" };

/** Studio audit trail with filters (plan 17.8). */
export default async function AuditPage({ searchParams }: PageProps<"/studio/settings/audit">) {
  const ctx = await requireStudioPage("admin");
  const sp = await searchParams;
  const actor = typeof sp.actor === "string" ? sp.actor : undefined;
  const action = typeof sp.action === "string" ? sp.action : undefined;
  const since = typeof sp.since === "string" && sp.since ? `${sp.since}T00:00:00` : undefined;
  const [entries, facets] = await Promise.all([
    listAuditLog(ctx.studio.id, { actor, action, since }),
    auditFacets(ctx.studio.id),
  ]);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-medium">Activity log</h2>
          <p className="text-sm text-ink-2">Who did what, and when. Security and account changes are always recorded.</p>
        </div>
        <AuditFilters actors={facets.actors} actions={facets.actions} />
      </div>
      {entries.length === 0 ? (
        <EmptyState title="Nothing recorded yet" description="Actions like invites, role changes and deletions appear here." />
      ) : (
        <Table>
          <thead><tr><Th>When</Th><Th>Who</Th><Th>Action</Th><Th>Details</Th></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <Td><span className="text-xs text-muted whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</span></Td>
                <Td><span className="text-sm">{e.actor_name || e.actor_label || "System"}</span></Td>
                <Td><span className="font-mono text-xs">{e.action}</span></Td>
                <Td><span className="text-xs text-ink-2 break-all">{e.metadata && Object.keys(e.metadata).length ? JSON.stringify(e.metadata) : e.target_type ? `${e.target_type} ${e.target_id ?? ""}` : ""}</span></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
