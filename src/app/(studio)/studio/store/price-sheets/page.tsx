import { requireStudioPage } from "@/lib/auth";
import { listPriceSheetsWithRows } from "@/lib/store";
import { formatMoney, storeLicenseLabels, storeResolutionLabels } from "@/lib/types";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { UpgradeLock } from "@/components/studio/upgrade-lock";
import { PriceSheetDialog } from "./price-sheet-dialog";
import { deletePriceSheetAction } from "../actions";

export const metadata = { title: "Price sheets" };

export default async function PriceSheetsPage() {
  const ctx = await requireStudioPage("admin");
  if (!ctx.entitlements.store) {
    return (
      <>
        <PageHeader title="Price sheets" description="Reusable pricing presets you can apply to products." />
        <UpgradeLock title="Online store">Save a set of prices once and apply it across many products.</UpgradeLock>
      </>
    );
  }
  const sheets = await listPriceSheetsWithRows(ctx.studio.id);
  const cur = ctx.studio.currency;

  return (
    <>
      <PageHeader
        title="Price sheets"
        description="Save a set of resolution × licence prices once, then apply it to any product from the store list."
        actions={
          <div className="flex gap-2">
            <ButtonLink href="/studio/store" variant="secondary">Products</ButtonLink>
            <PriceSheetDialog trigger="add" />
          </div>
        }
      />
      {sheets.length === 0 ? (
        <EmptyState title="No price sheets yet" description="Create a preset — e.g. a standard set of print and licence prices — and reuse it across products." action={<PriceSheetDialog trigger="add" />} />
      ) : (
        <ul className="space-y-3">
          {sheets.map(({ sheet, rows }) => (
            <li key={sheet.id} className="card card-pad flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{sheet.name}</p>
                <p className="text-xs text-muted">
                  {rows.length === 0
                    ? "No prices"
                    : rows.map((r) => `${storeResolutionLabels[r.resolution]}/${storeLicenseLabels[r.license]} ${formatMoney(r.amount_cents, cur)}`).join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <PriceSheetDialog trigger="edit" sheet={sheet} rows={rows} />
                <form action={deletePriceSheetAction}>
                  <input type="hidden" name="id" value={sheet.id} />
                  <button className="text-xs text-muted hover:text-ink">Delete</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
