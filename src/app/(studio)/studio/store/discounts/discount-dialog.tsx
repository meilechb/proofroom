"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { saveDiscountAction } from "../actions";

export function DiscountDialog() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveDiscountAction, initialActionState);
  const [kind, setKind] = useState("percent");
  return (
    <>
      <Button onClick={() => setOpen(true)}>New code</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New discount code">
        <form action={action} className="space-y-4" noValidate>
          <FormMessage state={state} />
          <Field label="Code" htmlFor="d-code" error={state.fields?.code}><Input id="d-code" name="code" required placeholder="SUMMER10" className="uppercase" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="d-kind">
              <Select id="d-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="percent">Percent off</option>
                <option value="fixed">Amount off</option>
              </Select>
            </Field>
            <Field label={kind === "percent" ? "Percent" : "Amount"} htmlFor="d-amount" error={state.fields?.amount ?? state.fields?.value}>
              <Input id="d-amount" name="amount" inputMode="decimal" required placeholder={kind === "percent" ? "10" : "5.00"} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimum order" htmlFor="d-min" hint="Optional."><Input id="d-min" name="minSubtotal" inputMode="decimal" placeholder="0.00" /></Field>
            <Field label="Max uses" htmlFor="d-max" hint="Optional."><Input id="d-max" name="maxUses" type="number" min={1} placeholder="Unlimited" /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton>Save code</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
