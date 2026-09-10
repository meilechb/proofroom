import type { Metadata } from "next";
import { requirePlatformAdminPage } from "@/lib/auth";
import { adminEmailStats } from "@/lib/admin";
import { Stat, Card, Table, Th, Td, Badge } from "@/components/ui";

export const metadata: Metadata = { title: "Emails · Admin" };

export default async function AdminEmailsPage() {
  await requirePlatformAdminPage();
  const { totals, recent } = await adminEmailStats(30);
  const attempted = totals.sent + totals.failed;
  const failureRate = attempted > 0 ? Math.round((totals.failed / attempted) * 100) : 0;
  const bounceRate = totals.sent > 0 ? Math.round((totals.bounced / totals.sent) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Email (all studios)</h1>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Sent (30d)" value={totals.sent.toLocaleString()} />
        <Stat label="Failure rate" value={`${failureRate}%`} hint={`${totals.failed} failed`} />
        <Stat label="Bounce rate" value={`${bounceRate}%`} hint={`${totals.bounced} bounced`} />
        <Stat label="Complaints" value={totals.complained.toLocaleString()} />
      </div>
      <Card pad={false}>
        <Table>
          <thead><tr><Th>Studio</Th><Th>Recipient</Th><Th>Subject</Th><Th>Status</Th><Th>When</Th></tr></thead>
          <tbody>
            {recent.map((e) => (
              <tr key={e.id}>
                <Td><span className="text-xs">{e.studio_name ?? "platform"}</span></Td>
                <Td><span className="text-xs">{e.to_address}</span></Td>
                <Td><span className="text-xs truncate">{e.subject}</span></Td>
                <Td><Badge tone={e.status === "failed" ? "danger" : e.status === "skipped" ? "warning" : "success"}>{e.status}</Badge></Td>
                <Td><span className="text-xs text-muted whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</span></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
