import { requireStudioPage } from "@/lib/auth";
import { storeAnalytics } from "@/lib/store";
import { formatMoney } from "@/lib/types";
import { ButtonLink, EmptyState, PageHeader, Stat } from "@/components/ui";
import { UpgradeLock } from "@/components/studio/upgrade-lock";

export const metadata = { title: "Store analytics" };

export default async function StoreAnalyticsPage() {
  const ctx = await requireStudioPage("admin");
  if (!ctx.entitlements.store) {
    return (
      <>
        <PageHeader title="Store analytics" description="Revenue and your best sellers." />
        <UpgradeLock title="Online store">See revenue, average order value and your top products and buyers.</UpgradeLock>
      </>
    );
  }
  const a = await storeAnalytics(ctx.studio.id);
  const cur = ctx.studio.currency;

  return (
    <>
      <PageHeader
        title="Store analytics"
        description="Revenue and your best sellers, from every completed order."
        actions={
          <div className="flex gap-2">
            <ButtonLink href="/studio/store/orders" variant="secondary">Orders</ButtonLink>
            <ButtonLink href="/studio/store" variant="secondary">Products</ButtonLink>
          </div>
        }
      />
      {a.orders === 0 ? (
        <EmptyState title="No sales yet" description="Once you make your first sale, revenue and your top products appear here." />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Stat label="Net revenue" value={formatMoney(a.netCents, cur)} />
            <Stat label="Gross" value={formatMoney(a.grossCents, cur)} />
            <Stat label="Orders" value={String(a.orders)} />
            <Stat label="Avg. order" value={formatMoney(a.aovCents, cur)} />
            <Stat label="Items sold" value={String(a.unitsSold)} />
          </div>
          {a.giftCardOutstandingCents > 0 ? (
            <p className="mt-3 text-xs text-muted">Gift-card balance outstanding: {formatMoney(a.giftCardOutstandingCents, cur)}</p>
          ) : null}

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <section>
              <h2 className="text-sm font-medium mb-2">Top products</h2>
              <ul className="card divide-y divide-line">
                {a.topProducts.map((p, i) => (
                  <li key={i} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <span className="min-w-0 truncate text-sm">{p.title}</span>
                    <span className="shrink-0 text-sm text-muted">{p.units} sold · <span className="text-ink">{formatMoney(p.revenue, cur)}</span></span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-sm font-medium mb-2">Top buyers</h2>
              <ul className="card divide-y divide-line">
                {a.topBuyers.map((b, i) => (
                  <li key={i} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <span className="min-w-0 truncate text-sm">{b.email}</span>
                    <span className="shrink-0 text-sm text-muted">{b.orders} order{b.orders === 1 ? "" : "s"} · <span className="text-ink">{formatMoney(b.spend, cur)}</span></span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </>
  );
}
