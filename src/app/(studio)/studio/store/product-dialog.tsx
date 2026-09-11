"use client";

import { useActionState, useState } from "react";
import type { ProductPrice, StoreLicense, StoreProduct, StoreResolution } from "@/lib/types";
import { storeLicenseLabels, storeResolutionLabels } from "@/lib/types";
import { parseRmMatrix, RM_DIMENSIONS } from "@/lib/store-shared";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { ImagePicker, type PickerAsset } from "../website/image-picker";
import { saveProductAction } from "./actions";

type Tier = { dims: Record<string, string>; amount: string };
type Row = { resolution: StoreResolution; license: StoreLicense; amount: string; tiers: Tier[]; compareAt: string; saleStart: string; saleEnd: string };

const RES: StoreResolution[] = ["web", "standard", "original"];
const LIC: StoreLicense[] = ["personal", "rf", "rm", "extended"];
const EMPTY_ROW: Row = { resolution: "original", license: "personal", amount: "", tiers: [], compareAt: "", saleStart: "", saleEnd: "" };

function tiersFromMatrix(raw: unknown): Tier[] {
  return parseRmMatrix(raw).map((row) => ({
    dims: Object.fromEntries(RM_DIMENSIONS.map((d) => [d.key, typeof row.when[d.key] === "string" ? (row.when[d.key] as string) : ""])),
    amount: (row.amountCents / 100).toString(),
  }));
}

/** ISO → a `datetime-local` value (local wall time), for editing a stored sale window. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ProductDialog({ product, prices, trigger, assets, galleries }: { product?: StoreProduct; prices?: ProductPrice[]; trigger: "add" | "edit"; assets: PickerAsset[]; galleries: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveProductAction, initialActionState);
  const [assetId, setAssetId] = useState<string | null>(product?.asset_id ?? null);
  const [kind, setKind] = useState<string>(product?.kind === "gallery_unlock" ? "gallery_unlock" : "image");
  const [galleryId, setGalleryId] = useState<string>(product?.gallery_id ?? "");
  const [rows, setRows] = useState<Row[]>(
    prices && prices.length
      ? prices.map((p) => ({
          resolution: p.resolution,
          license: p.license,
          amount: (p.amount_cents / 100).toString(),
          tiers: p.license === "rm" ? tiersFromMatrix(p.rm_matrix) : [],
          compareAt: p.compare_at_cents != null ? (p.compare_at_cents / 100).toString() : "",
          saleStart: toLocalInput(p.sale_starts_at),
          saleEnd: toLocalInput(p.sale_ends_at),
        }))
      : [{ ...EMPTY_ROW }]
  );
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setTier = (i: number, ti: number, patch: Partial<Tier>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, tiers: r.tiers.map((t, k) => (k === ti ? { ...t, ...patch } : t)) } : r)));

  const pricesJson = JSON.stringify(
    rows
      .filter((r) => r.amount.trim() !== "")
      .map((r) => ({
        resolution: r.resolution,
        license: r.license,
        amount: r.amount,
        compareAt: r.compareAt,
        saleStart: r.saleStart,
        saleEnd: r.saleEnd,
        ...(r.license === "rm"
          ? {
              rmMatrix: r.tiers
                .filter((t) => t.amount.trim() !== "")
                .map((t) => ({ when: Object.fromEntries(RM_DIMENSIONS.filter((d) => t.dims[d.key]).map((d) => [d.key, t.dims[d.key]])), amountCents: Math.round(Number(t.amount) * 100) })),
            }
          : {}),
      }))
  );

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
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="galleryId" value={kind === "gallery_unlock" ? galleryId : ""} />
          <input type="hidden" name="prices" value={pricesJson} />
          <input type="hidden" name="assetId" value={assetId ?? ""} />
          <FormMessage state={state} />
          <Field label="Name" htmlFor="s-title" error={state.fields?.title}><Input id="s-title" name="title" required defaultValue={product?.title} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="What you're selling" htmlFor="s-kind">
              <Select id="s-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="image">A single image</option>
                <option value="gallery_unlock">A whole gallery (unlock)</option>
              </Select>
            </Field>
            {kind === "gallery_unlock" ? (
              <Field label="Gallery" htmlFor="s-gallery" hint="The buyer gets every photo in it.">
                <Select id="s-gallery" value={galleryId} onChange={(e) => setGalleryId(e.target.value)}>
                  <option value="">Choose a gallery…</option>
                  {galleries.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                </Select>
              </Field>
            ) : null}
          </div>
          <Field label="Description" htmlFor="s-desc"><Textarea id="s-desc" name="description" rows={2} defaultValue={product?.description ?? ""} /></Field>
          <ImagePicker label={kind === "gallery_unlock" ? "Cover image" : "Image"} value={assetId} assets={assets} onChange={setAssetId} />

          <div>
            <div className="flex items-center justify-between">
              <span className="label">Price options</span>
              <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setRows((rs) => [...rs, { ...EMPTY_ROW }])}>Add option</button>
            </div>
            {state.fields?.prices ? <p className="field-error" role="alert">{state.fields.prices}</p> : null}
            <div className="mt-2 space-y-3">
              {rows.map((r, i) => (
                <div key={i} className="rounded-lg border border-line-2 p-2">
                  <div className="flex items-center gap-2">
                    <Select aria-label="Resolution" value={r.resolution} onChange={(e) => setRow(i, { resolution: e.target.value as StoreResolution })}>
                      {RES.map((v) => <option key={v} value={v}>{storeResolutionLabels[v]}</option>)}
                    </Select>
                    <Select aria-label="Licence" value={r.license} onChange={(e) => setRow(i, { license: e.target.value as StoreLicense })}>
                      {LIC.map((v) => <option key={v} value={v}>{storeLicenseLabels[v]}</option>)}
                    </Select>
                    <Input aria-label="Price" inputMode="decimal" placeholder="0.00" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} className="w-24" />
                    {rows.length > 1 ? <button type="button" aria-label="Remove price option" className="text-muted hover:text-ink px-1" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</button> : null}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-end gap-2 pl-1">
                    <label className="text-[11px] text-muted">Compare-at<Input aria-label="Compare-at price" inputMode="decimal" placeholder="was…" value={r.compareAt} onChange={(e) => setRow(i, { compareAt: e.target.value })} className="w-20 h-8 text-xs mt-0.5" /></label>
                    <label className="text-[11px] text-muted">Sale from<Input aria-label="Sale start" type="datetime-local" value={r.saleStart} onChange={(e) => setRow(i, { saleStart: e.target.value })} className="h-8 text-xs mt-0.5" /></label>
                    <label className="text-[11px] text-muted">Sale until<Input aria-label="Sale end" type="datetime-local" value={r.saleEnd} onChange={(e) => setRow(i, { saleEnd: e.target.value })} className="h-8 text-xs mt-0.5" /></label>
                  </div>
                  {r.license === "rm" ? (
                    <div className="mt-2 pl-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted">Rights-managed tiers — the price above is the “from” price; a matching tier overrides it. “Any” leaves that field open.</span>
                        <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setRow(i, { tiers: [...r.tiers, { dims: {}, amount: "" }] })}>Add tier</button>
                      </div>
                      <div className="mt-1 space-y-1.5">
                        {r.tiers.map((t, ti) => (
                          <div key={ti} className="flex flex-wrap items-center gap-1.5">
                            {RM_DIMENSIONS.map((d) => (
                              <Select key={d.key} aria-label={d.label} value={t.dims[d.key] ?? ""} onChange={(e) => setTier(i, ti, { dims: { ...t.dims, [d.key]: e.target.value } })} className="h-8 text-xs">
                                <option value="">Any {d.label.toLowerCase()}</option>
                                {d.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </Select>
                            ))}
                            <Input aria-label="Tier price" inputMode="decimal" placeholder="0.00" value={t.amount} onChange={(e) => setTier(i, ti, { amount: e.target.value })} className="w-20 h-8 text-xs" />
                            <button type="button" aria-label="Remove tier" className="text-muted hover:text-ink px-1" onClick={() => setRow(i, { tiers: r.tiers.filter((_, k) => k !== ti) })}>×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
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
