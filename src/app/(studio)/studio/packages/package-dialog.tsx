"use client";

import { useActionState, useState } from "react";
import type { Package } from "@/lib/types";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { MoneyField } from "@/components/ui/fields";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { savePackageAction } from "./actions";

export function PackageDialog({ pkg, trigger }: { pkg?: Package; trigger: "add" | "edit" }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(savePackageAction, initialActionState);
  return (
    <>
      {trigger === "add" ? (
        <Button onClick={() => setOpen(true)}>Add package</Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Edit</Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={pkg ? "Edit package" : "Add a package"}>
        <form action={action} className="space-y-4" noValidate>
          {pkg ? <input type="hidden" name="id" value={pkg.id} /> : null}
          <FormMessage state={state} />
          <Field label="Name" htmlFor="p-name" error={state.fields?.name}><Input id="p-name" name="name" required defaultValue={pkg?.name} /></Field>
          <Field label="Description" htmlFor="p-desc" hint="Shown on your website and booking page."><Textarea id="p-desc" name="description" rows={2} defaultValue={pkg?.description ?? ""} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField name="price" label="Price" defaultCents={pkg?.price_cents ?? 0} />
            <MoneyField name="deposit" label="Deposit" defaultCents={pkg?.deposit_cents ?? 0} hint="Charged to book." />
            <Field label="Photos included" htmlFor="p-incl" error={state.fields?.includedFinals}><Input id="p-incl" name="included" type="number" min={0} defaultValue={pkg?.included_finals ?? 0} /></Field>
            <MoneyField name="extra" label="Each extra photo" defaultCents={pkg?.extra_final_cents ?? 0} />
          </div>
          <Field label="Turnaround" htmlFor="p-turn" hint="e.g. 3 to 5 business days."><Input id="p-turn" name="turnaround" defaultValue={pkg?.turnaround ?? ""} /></Field>
          <Field label="What's included" htmlFor="p-includes" hint="One line per item."><Textarea id="p-includes" name="includes" rows={3} defaultValue={(pkg?.includes ?? []).join("\n")} /></Field>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={pkg?.is_active ?? true} className="h-4 w-4" /> Active</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={pkg?.is_featured ?? false} className="h-4 w-4" /> Featured on site</label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton>{pkg ? "Save" : "Add package"}</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
