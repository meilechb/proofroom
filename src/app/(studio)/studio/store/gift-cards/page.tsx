import { requireStudioPage } from "@/lib/auth";
import { listGiftCards } from "@/lib/store";
import { formatMoney } from "@/lib/types";
import { Badge, ButtonLink, EmptyState, Input, PageHeader } from "@/components/ui";
import { UpgradeLock } from "@/components/studio/upgrade-lock";
import { GiftCardDialog } from "./gift-card-dialog";
import { adjustGiftCardAction, toggleGiftCardAction } from "../actions";

export const metadata = { title: "Gift cards" };

export default async function GiftCardsPage() {
  const ctx = await requireStudioPage("admin");
  if (!ctx.entitlements.store) {
    return (
      <>
        <PageHeader title="Gift cards" description="Store credit buyers can redeem at checkout." />
        <UpgradeLock title="Online store">Issue gift cards and let buyers spend them against anything in your store.</UpgradeLock>
      </>
    );
  }
  const cards = await listGiftCards(ctx.studio.id);
  const cur = ctx.studio.currency;

  return (
    <>
      <PageHeader
        title="Gift cards"
        description="Issue store credit. Each code is shown once, when you create it."
        actions={
          <div className="flex gap-2">
            <ButtonLink href="/studio/store" variant="secondary">Products</ButtonLink>
            <GiftCardDialog />
          </div>
        }
      />
      {cards.length === 0 ? (
        <EmptyState title="No gift cards yet" description="Issue a gift card and share its code with a buyer." action={<GiftCardDialog />} />
      ) : (
        <ul className="space-y-2">
          {cards.map((c) => {
            const spent = c.initial_cents - c.balance_cents;
            const expired = c.expires_at != null && new Date(c.expires_at) < new Date();
            return (
              <li key={c.id} className="card card-pad flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">•••• {c.code_last4}</span>
                    {!c.is_active ? <Badge>Off</Badge> : null}
                    {expired ? <Badge>Expired</Badge> : null}
                  </div>
                  <p className="text-xs text-muted">
                    {formatMoney(c.balance_cents, cur)} left of {formatMoney(c.initial_cents, cur)}
                    {spent > 0 ? ` · ${formatMoney(spent, cur)} spent` : ""}
                    {c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <form action={adjustGiftCardAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={c.id} />
                    <Input name="amount" inputMode="decimal" placeholder="±10.00" className="h-8 w-24 text-sm" aria-label="Adjust balance" />
                    <button className="text-xs text-muted hover:text-ink">Adjust</button>
                  </form>
                  <form action={toggleGiftCardAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="active" value={c.is_active ? "false" : "true"} />
                    <button className="text-xs text-muted hover:text-ink">{c.is_active ? "Turn off" : "Turn on"}</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
