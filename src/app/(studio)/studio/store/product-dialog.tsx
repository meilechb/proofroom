"use client";

import { useActionState, useState } from "react";
import type { ProductPrice, StoreLicense, StoreProduct, StoreResolution } from "@/lib/types";
import { storeLicenseLabels, storeResolutionLabels } from "@/lib/types";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { ImagePicker, type PickerAsset } from "../website/image-picker";
import { saveProductAction } from "./actions";

type Row = { resolution: StoreResolution; license: StoreLicense; amount: string };

const RES: StoreResolution[] = ["web", "standard", "original"];
const LIC: StoreLicense[] = ["personal", "rf", "rm", "extended"];

export function ProductDialog({ product, prices, trigger, assets }: { product?: StoreProduct; prices?: ProductPrice[]; trigger: "add" | "edit"; assets: PickerAsset[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveProductAction, initialActionState);
  const [assetId, setAssetId] = useState<string | null>(product?.asset_id ?? null);
  const [rows, setRows] = useState<Row[]>(
    prices && prices.length
      ? prices.map((p) => ({ resolution: p.resolution, license: p.license, amount: (p.amount_cents / 100).toString() }))
      : [{ resolution: "original", license: "personal", amount: "" }]
  );
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const pricesJson = JSON.stringify(rows.filter((r) => r.amount.trim() !== "").map((r) => ({ resolution: r.resolution, license: r.license, amount: r.amount })));

  return (
    <>
      {trigger === "add" ? (
        <Button onClick={() => setOpen(true)}>Add product</Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Edit</Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={product ? "Edit product" : "Add a product"}>
        <form action={action} className="space-y-4" noValidate>
          {product ? <input type="hidden" name="id" value={product.id} /> : null}
          <input type="hidden" name="kind" value={product?.kind ?? "image"} />
          <input type="hidden" name="prices" value={pricesJson} />
          <input type="hidden" name="assetId" value={assetId ?? ""} />
          <FormMessage state={state} />
          <Field label="Name" htmlFor="s-title" error={state.fields?.title}><Input id="s-title" name="title" required defaultValue={product?.title} /></Field>
          <Field label="Description" htmlFor="s-desc"><Textarea id="s-desc" name="description" rows={2} defaultValue={product?.description ?? ""} /></Field>
          <ImagePicker label="Image" value={assetId} assets={assets} onChange={setAssetId} />

          <div>
            <div className="flex items-center justify-between">
              <span className="label">Price options</span>
              <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setRows((rs) => [...rs, { resolution: "original", license: "personal", amount: "" }])}>Add option</button>
            </div>
            {state.fields?.prices ? <p className="field-error" role="alert">{state.fields.prices}</p> : null}
            <div className="mt-2 space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select aria-label="Resolution" value={r.resolution} onChange={(e) => setRow(i, { resolution: e.target.value as StoreResolution })}>
                    {RES.map((v) => <option key={v} value={v}>{storeResolutionLabels[v]}</option>)}
                  </Select>
                  <Select aria-label="Licence" value={r.license} onChange={(e) => setRow(i, { license: e.target.value as StoreLicense })}>
                    {LIC.map((v) => <option key={v} value={v}>{storeLicenseLabels[v]}</option>)}
                  </Select>
                  <Input aria-label="Price" inputMode="decimal" placeholder="0.00" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} className="w-24" />
                  {rows.length > 1 ? <button type="button" aria-label="Remove price option" className="text-muted hover:text-ink px-1" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</button> : null}
                </div>
              ))}
            </div>
          </div>

          <Field label="Licence / print release text" htmlFor="s-lic" hint="Shown to the buyer and recorded on their receipt."><Textarea id="s-lic" name="licenseText" rows={3} defaultValue={product?.license_text ?? ""} /></Field>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={product?.is_active ?? true} className="h-4 w-4" /> Active</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={product?.is_featured ?? false} className="h-4 w-4" /> Featured</label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton>{product ? "Save" : "Add product"}</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
