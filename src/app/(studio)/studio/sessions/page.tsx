import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { listOrders } from "@/lib/orders";
import { listPackages } from "@/lib/packages";
import { searchClients } from "@/lib/clients";
import { formatDate, formatMoney, orderStatusLabels, type OrderStatus } from "@/lib/types";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { Tabs } from "@/components/ui/tabs";
import { NewSessionButton } from "./new-session-dialog";

export const metadata = { title: "Sessions" };

export default async function SessionsPage({ searchParams }: PageProps<"/studio/sessions">) {
  const ctx = await requireStudioPage();
  const sp = await searchParams;
  const tab = (["upcoming", "unpaid", "past", "all"].includes(String(sp.tab)) ? sp.tab : "all") as "upcoming" | "unpaid" | "past" | "all";
  const presetClient = typeof sp.client === "string" ? sp.client : undefined;

  const [orders, clients, packages] = await Promise.all([
    listOrders(ctx.studio.id, { status: tab }),
    searchClients(ctx.studio.id, { archived: false }, 500),
    listPackages(ctx.studio.id, true),
  ]);
  const cur = ctx.studio.currency;
  const clientOpts = clients.map((c) => ({ id: c.id, name: c.name, email: c.email }));
  const pkgOpts = packages.map((p) => ({ id: p.id, name: p.name }));

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Every shoot, with its money and agreement status."
        actions={<NewSessionButton clients={clientOpts} packages={pkgOpts} timezone={ctx.studio.timezone} presetClientId={presetClient} open={sp.new === "1"} />}
      />
      <Tabs items={[{ value: "all", label: "All" }, { value: "upcoming", label: "Upcoming" }, { value: "unpaid", label: "Unpaid" }, { value: "past", label: "Past" }]} />
      <div className="mt-4">
        {orders.length === 0 ? (
          <EmptyState
            title={tab === "all" ? "No sessions yet" : `Nothing ${tab}`}
            description="Create a session to send a deposit request, an agreement and later a gallery."
            action={<NewSessionButton clients={clientOpts} packages={pkgOpts} timezone={ctx.studio.timezone} />}
          />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 border-b border-line font-medium">Session</th>
                <th className="px-4 py-3 border-b border-line font-medium hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 border-b border-line font-medium">Status</th>
                <th className="px-4 py-3 border-b border-line font-medium text-right">Total</th>
                <th className="px-4 py-3 border-b border-line font-medium text-right">Balance</th>
                <th className="px-4 py-3 border-b border-line font-medium text-center hidden md:table-cell">Agreement</th>
              </tr></thead>
              <tbody>
                {orders.map((o) => {
                  const balance = Math.max(0, o.amount_cents - o.discount_cents - o.paid_cents);
                  return (
                    <tr key={o.id} className="hover:bg-surface-2/60">
                      <td className="px-4 py-3 border-b border-line">
                        <Link href={`/studio/sessions/${o.id}`} className="font-medium hover:underline">#{o.order_number} {o.title}</Link>
                        <div className="text-xs text-muted"><Link href={`/studio/clients/${o.client_id}`} className="hover:underline">{o.client_name}</Link></div>
                      </td>
                      <td className="px-4 py-3 border-b border-line hidden sm:table-cell text-ink-2">{o.scheduled_at ? formatDate(o.scheduled_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</td>
                      <td className="px-4 py-3 border-b border-line"><Badge tone={o.status === "completed" ? "success" : o.status === "cancelled" ? "neutral" : o.status === "pending_payment" ? "warning" : "brand"}>{orderStatusLabels[o.status as OrderStatus] ?? o.status}</Badge></td>
                      <td className="px-4 py-3 border-b border-line text-right">{formatMoney(o.amount_cents - o.discount_cents, cur)}</td>
                      <td className="px-4 py-3 border-b border-line text-right">{balance > 0 ? <span className="text-danger font-medium">{formatMoney(balance, cur)}</span> : <span className="text-muted">Paid</span>}</td>
                      <td className="px-4 py-3 border-b border-line text-center hidden md:table-cell">{o.contract_signed_at ? <Badge tone="success">Signed</Badge> : <Badge>Unsigned</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
