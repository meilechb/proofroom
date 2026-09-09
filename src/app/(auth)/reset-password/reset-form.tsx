"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "../actions";
import { initialActionState } from "@/lib/action-state";
import { Field, Input } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, initialActionState);
  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <Field label="New password" htmlFor="password" error={state.fields?.password} hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={state.fields?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton className="w-full" pendingText="Saving…">Save password</SubmitButton>
    </form>
  );
}
