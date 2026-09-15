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
      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span><strong>I collect payment myself.</strong> The pay page shows your instructions instead of a card form. You mark sessions paid by hand.</span>
        <span className="relative inline-flex shrink-0">
          <input type="checkbox" name="manual" className="peer sr-only" checked={on} onChange={(e) => setOn(e.target.checked)} />
          <span aria-hidden className="relative block h-[26px] w-[46px] rounded-full bg-line-2 transition-colors peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 peer-focus-visible:ring-offset-1 after:absolute after:left-[3px] after:top-[3px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-[19px]" />
        </span>
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
