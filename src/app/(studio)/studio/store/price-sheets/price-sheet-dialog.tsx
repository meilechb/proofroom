"use client";

import { useActionState, useState } from "react";
import type { PriceSheet, PriceSheetRow, StoreLicense, StoreResolution } from "@/lib/types";
import { storeLicenseLabels, storeResolutionLabels } from "@/lib/types";
import { Button, Field, Input, Select } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { savePriceSheetAction } from "../actions";

type Row = { resolution: StoreResolution; license: StoreLicense; amount: string };

const RES: StoreResolution[] = ["web", "standard", "original"];
const LIC: StoreLicense[] = ["personal", "rf", "rm", "extended"];

export function PriceSheetDialog({ sheet, rows: initialRows, trigger }: { sheet?: PriceSheet; rows?: PriceSheetRow[]; trigger: "add" | "edit" }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(savePriceSheetAction, initialActionState);
  const [rows, setRows] = useState<Row[]>(
    initialRows && initialRows.length
      ? initialRows.map((p) => ({ resolution: p.resolution, license: p.license, amount: (p.amount_cents / 100).toString() }))
      : [{ resolution: "original", license: "personal", amount: "" }]
  );
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const pricesJson = JSON.stringify(rows.filter((r) => r.amount.trim() !== "").map((r) => ({ resolution: r.resolution, license: r.license, amount: r.amount })));

  return (
    <>
      {trigger === "add" ? (
        <Button onClick={() => setOpen(true)}>New price sheet</Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Edit</Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={sheet ? "Edit price sheet" : "New price sheet"}>
        <form action={action} className="space-y-4" noValidate>
          {sheet ? <input type="hidden" name="id" value={sheet.id} /> : null}
          <input type="hidden" name="prices" value={pricesJson} />
          <FormMessage state={state} />
          <Field label="Name" htmlFor="ps-name" error={state.fields?.name}><Input id="ps-name" name="name" required placeholder="Portraits — standard" defaultValue={sheet?.name} /></Field>
          <div>
            <div className="flex items-center justify-between">
              <span className="label">Prices</span>
              <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setRows((rs) => [...rs, { resolution: "original", license: "personal", amount: "" }])}>Add row</button>
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
                  {rows.length > 1 ? <button type="button" aria-label="Remove row" className="text-muted hover:text-ink px-1" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</button> : null}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton>{sheet ? "Save" : "Add"}</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
