import { requireStudioPage } from "@/lib/auth";
import { db, rows as sqlRows } from "@/lib/db";
import { listPriceSheets, listProductPrices, listProducts } from "@/lib/store";
import { isReady, listAssets } from "@/lib/assets";
import { formatMoney } from "@/lib/types";
import { Badge, ButtonLink, EmptyState, PageHeader, Select } from "@/components/ui";
import { UpgradeLock } from "@/components/studio/upgrade-lock";
import type { PickerAsset } from "../website/image-picker";
import { ProductDialog } from "./product-dialog";
import { applyPriceSheetAction, archiveProductAction } from "./actions";

export const metadata = { title: "Store" };

export default async function StorePage() {
  const ctx = await requireStudioPage("admin");
  if (!ctx.entitlements.store) {
    return (
      <>
        <PageHeader title="Store" description="Sell your photos, packages and licences online." />
        <UpgradeLock title="Online store">Sell individual images, packages and whole-gallery unlocks, paid straight into your own Stripe.</UpgradeLock>
      </>
    );
  }

  const products = await listProducts(ctx.studio.id);
  const priceRows = await Promise.all(products.map(async (p) => [p.id, await listProductPrices(ctx.studio.id, p.id)] as const));
  const prices = new Map(priceRows);
  const pickerAssets: PickerAsset[] = (await listAssets(ctx.studio.id)).filter(isReady).map((a) => ({ id: a.id, thumb: a.thumb_url ?? a.web_url ?? a.url, filename: a.filename, alt: a.alt }));
  const galleryList = sqlRows<{ id: string; title: string }>(await db()`select id, title from galleries where studio_id = ${ctx.studio.id} and parent_id is null order by created_at desc`);
  const sheets = await listPriceSheets(ctx.studio.id);
  const cur = ctx.studio.currency;

  return (
    <>
      <PageHeader
        title="Store"
        description="Sell your photos, packages and licences online. Paid into your own Stripe."
        actions={
          <div className="flex gap-2">
            <ButtonLink href="/studio/store/orders" variant="secondary">Orders</ButtonLink>
            <ButtonLink href="/studio/store/discounts" variant="secondary">Discounts</ButtonLink>
            <ButtonLink href="/studio/store/gift-cards" variant="secondary">Gift cards</ButtonLink>
            <ButtonLink href="/studio/store/price-sheets" variant="secondary">Price sheets</ButtonLink>
            <ButtonLink href="/studio/store/settings" variant="secondary">Settings</ButtonLink>
            <ProductDialog trigger="add" assets={pickerAssets} galleries={galleryList} />
          </div>
        }
      />
      {products.length === 0 ? (
        <EmptyState
          title="Nothing for sale yet"
          description="Add a product — an image, a package, or a whole-gallery unlock — with a price and a licence."
          action={<ProductDialog trigger="add" assets={pickerAssets} galleries={galleryList} />}
        />
      ) : (
        <ul className="space-y-3">
          {products.map((p) => {
            const rows = prices.get(p.id) ?? [];
            const from = rows.length ? Math.min(...rows.map((r) => r.amount_cents)) : 0;
            return (
              <li key={p.id} className="card card-pad flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium">{p.title}</h2>
                    {p.is_featured ? <Badge tone="brand">Featured</Badge> : null}
                    {!p.is_active ? <Badge>Archived</Badge> : null}
                  </div>
                  {p.description ? <p className="mt-0.5 text-sm text-ink-2 line-clamp-1">{p.description}</p> : null}
                  <p className="mt-1 text-xs text-muted">
                    {rows.length ? `From ${formatMoney(from, cur)} · ${rows.length} price option${rows.length > 1 ? "s" : ""}` : "No price set"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {sheets.length > 0 ? (
                    <form action={applyPriceSheetAction} className="flex items-center gap-1">
                      <input type="hidden" name="productId" value={p.id} />
                      <Select name="sheetId" defaultValue="" aria-label="Apply a price sheet" className="h-8 text-xs">
                        <option value="" disabled>Apply sheet…</option>
                        {sheets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </Select>
                      <button className="text-xs text-muted hover:text-ink">Apply</button>
                    </form>
                  ) : null}
                  <ProductDialog product={p} prices={rows} trigger="edit" assets={pickerAssets} galleries={galleryList} />
                  <form action={archiveProductAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="active" value={p.is_active ? "false" : "true"} />
                    <button className="text-xs text-muted hover:text-ink">{p.is_active ? "Archive" : "Restore"}</button>
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
