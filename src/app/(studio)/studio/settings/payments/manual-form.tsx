"use client";

import { useActionState, useState } from "react";
import { initialActionState } from "@/lib/action-state";
import { Field, Input, Textarea } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { saveManualPaymentsAction } from "./actions";

export function ManualPaymentsForm({ enabled, instructions, link }: { enabled: boolean; instructions: string; link: string }) {
  const [state, action] = useActionState(saveManualPaymentsAction, initialActionState);
  const [on, setOn] = useState(enabled);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="manual" className="mt-1 h-4 w-4" checked={on} onChange={(e) => setOn(e.target.checked)} />
        <span><strong>I collect payment myself.</strong> The pay page shows your instructions instead of a card form. You mark sessions paid by hand.</span>
      </label>
      {on ? (
        <>
          <Field label="Instructions for clients" htmlFor="instructions" error={state.fields?.instructions} hint="For example: Zelle to 555-0100, or bring a card to the session.">
            <Textarea id="instructions" name="instructions" defaultValue={instructions} rows={3} />
          </Field>
          <Field label="Payment link (optional)" htmlFor="link" error={state.fields?.link} hint="A Stripe Payment Link or any https link where clients can pay.">
            <Input id="link" name="link" type="url" defaultValue={link} placeholder="https://buy.stripe.com/..." />
          </Field>
        </>
      ) : null}
      <SubmitButton variant="secondary">Save</SubmitButton>
    </form>
  );
}
