"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { issueGiftCardAction } from "../actions";

export function GiftCardDialog() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(issueGiftCardAction, initialActionState);
  return (
    <>
      <Button onClick={() => setOpen(true)}>New gift card</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New gift card">
        <form action={action} className="space-y-4" noValidate>
          <FormMessage state={state} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" htmlFor="g-amount" error={state.fields?.initialCents}>
              <Input id="g-amount" name="amount" inputMode="decimal" required placeholder="50.00" />
            </Field>
            <Field label="Expires" htmlFor="g-expires" hint="Optional." error={state.fields?.expiresAt}>
              <Input id="g-expires" name="expires" type="date" />
            </Field>
          </div>
          <p className="text-xs text-muted">The code appears once, here, after you create it — copy it before closing.</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton>Create</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
