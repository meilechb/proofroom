import type { Metadata } from "next";
import { requirePlatformAdminPage } from "@/lib/auth";
import { platformMetrics } from "@/lib/admin";
import { formatBytes } from "@/lib/assets-shared";
import { formatMoney } from "@/lib/types";
import { Card, Stat, Table, Th, Td } from "@/components/ui";

export const metadata: Metadata = { title: "Metrics · Admin" };

export default async function AdminMetricsPage() {
  await requirePlatformAdminPage();
  const m = await platformMetrics();
  const peak = Math.max(1, ...m.signups.map((s) => s.n));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Metrics</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="MRR" value={formatMoney(m.mrrCents)} hint={`${m.activeSubscriptions} active`} />
        <Stat label="Trial conversion" value={`${m.conversion}%`} />
        <Stat label="Galleries live" value={m.galleriesLive.toLocaleString()} />
        <Stat label="Storage" value={formatBytes(m.storageTotal)} />
        <Stat label="Emails (30d)" value={m.emailsSent.toLocaleString()} hint={`${m.emailsFailed} failed`} />
        <Stat label="Referral rewards" value={m.rewardsGranted.toLocaleString()} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-medium mb-3">Studios by state</h2>
          <ul className="space-y-1 text-sm">
            {Object.entries(m.byState).sort((a, b) => b[1] - a[1]).map(([state, n]) => (
              <li key={state} className="flex justify-between"><span className="capitalize">{state.replace("_", " ")}</span><span className="tabular-nums">{n}</span></li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="font-medium mb-3">Signups per week</h2>
          {m.signups.length === 0 ? <p className="text-sm text-muted">No signups yet.</p> : (
            <div className="flex items-end gap-1.5 h-28">
              {m.signups.map((s) => (
                <div key={s.week} className="flex-1 flex flex-col justify-end items-center gap-1" title={`Week of ${s.week}: ${s.n}`}>
                  <div className="w-full rounded-t bg-brand/80" style={{ height: `${Math.round((s.n / peak) * 100)}%`, minHeight: s.n > 0 ? 3 : 0 }} />
                  <span className="text-[10px] text-muted">{s.n}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="font-medium mb-3">Top storage</h2>
        {m.topStorage.length === 0 ? <p className="text-sm text-muted">No data.</p> : (
          <Table>
            <thead><tr><Th>Studio</Th><Th className="text-right">Storage</Th></tr></thead>
            <tbody>{m.topStorage.map((s) => <tr key={s.id}><Td>{s.name}</Td><Td className="text-right tabular-nums">{formatBytes(s.bytes)}</Td></tr>)}</tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
