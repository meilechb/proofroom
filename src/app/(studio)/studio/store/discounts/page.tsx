import { requireStudioPage } from "@/lib/auth";
import { listDiscounts } from "@/lib/store";
import { formatMoney, type DiscountCode } from "@/lib/types";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { UpgradeLock } from "@/components/studio/upgrade-lock";
import { DiscountDialog } from "./discount-dialog";
import { toggleDiscountAction } from "../actions";

export const metadata = { title: "Discount codes" };

export default async function DiscountsPage() {
  const ctx = await requireStudioPage("admin");
  if (!ctx.entitlements.store) {
    return (
      <>
        <PageHeader title="Discount codes" description="Codes buyers can enter at checkout." />
        <UpgradeLock title="Online store">Run sales with percent or fixed-amount codes.</UpgradeLock>
      </>
    );
  }
  const codes = await listDiscounts(ctx.studio.id);
  const cur = ctx.studio.currency;
  const describe = (c: DiscountCode) => (c.kind === "percent" ? `${c.value}% off` : c.kind === "fixed" ? `${formatMoney(c.value, cur)} off` : "Free shipping");

  return (
    <>
      <PageHeader
        title="Discount codes"
        description="Codes buyers can enter at checkout."
        actions={
          <div className="flex gap-2">
            <ButtonLink href="/studio/store" variant="secondary">Products</ButtonLink>
            <DiscountDialog />
          </div>
        }
      />
      {codes.length === 0 ? (
        <EmptyState title="No codes yet" description="Create a percent or fixed-amount code to run a sale." action={<DiscountDialog />} />
      ) : (
        <ul className="space-y-2">
          {codes.map((c) => (
            <li key={c.id} className="card card-pad flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{c.code}</span>
                  {!c.is_active ? <Badge>Off</Badge> : null}
                </div>
                <p className="text-xs text-muted">
                  {describe(c)}
                  {c.min_subtotal_cents ? ` · min ${formatMoney(c.min_subtotal_cents, cur)}` : ""}
                  {c.max_uses != null ? ` · ${c.uses}/${c.max_uses} used` : ` · ${c.uses} used`}
                </p>
              </div>
              <form action={toggleDiscountAction}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="active" value={c.is_active ? "false" : "true"} />
                <button className="text-xs text-muted hover:text-ink">{c.is_active ? "Turn off" : "Turn on"}</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
