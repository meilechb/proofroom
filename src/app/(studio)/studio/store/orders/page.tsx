import { requireStudioPage } from "@/lib/auth";
import { listSales, storeRevenueCents } from "@/lib/store";
import { formatDate, formatMoney, type SaleStatus } from "@/lib/types";
import { Badge, ButtonLink, EmptyState, PageHeader, Stat } from "@/components/ui";
import { UpgradeLock } from "@/components/studio/upgrade-lock";

export const metadata = { title: "Store orders" };

const statusTone: Record<SaleStatus, "neutral" | "success" | "warning" | "danger"> = {
  pending: "neutral",
  paid: "success",
  failed: "danger",
  refunded: "warning",
  partially_refunded: "warning",
  disputed: "danger",
};

export default async function StoreOrdersPage() {
  const ctx = await requireStudioPage("admin");
  if (!ctx.entitlements.store) {
    return (
      <>
        <PageHeader title="Store orders" description="Everything sold through your store." />
        <UpgradeLock title="Online store">Sell individual images, packages and whole-gallery unlocks, paid straight into your own Stripe.</UpgradeLock>
      </>
    );
  }
  const sales = await listSales(ctx.studio.id);
  const revenue = await storeRevenueCents(ctx.studio.id);
  const cur = ctx.studio.currency;

  return (
    <>
      <PageHeader title="Store orders" description="Everything sold through your store." actions={<ButtonLink href="/studio/store" variant="secondary">Products</ButtonLink>} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Net revenue" value={formatMoney(revenue, cur)} />
        <Stat label="Orders" value={String(sales.filter((s) => s.status === "paid" || s.status === "partially_refunded").length)} />
      </div>
      {sales.length === 0 ? (
        <EmptyState title="No orders yet" description="Sales from your store show up here — with the buyer, amount and status." />
      ) : (
        <ul className="space-y-2">
          {sales.map((s) => (
            <li key={s.id} className="card card-pad flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">#{s.order_number}</span>
                  <Badge tone={statusTone[s.status]}>{s.status.replace(/_/g, " ")}</Badge>
                </div>
                <p className="text-xs text-muted truncate">{s.buyer_email} · {formatDate(s.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatMoney(s.total_cents, cur)}</p>
                {s.refunded_cents > 0 ? <p className="text-xs text-muted">−{formatMoney(s.refunded_cents, cur)} refunded</p> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
