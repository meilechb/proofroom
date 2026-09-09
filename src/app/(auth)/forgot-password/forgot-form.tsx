"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "../actions";
import { initialActionState } from "@/lib/action-state";
import { Field, Input } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export function ForgotForm() {
  const [state, action] = useActionState(forgotPasswordAction, initialActionState);
  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <FormMessage state={state} />
      {!state.ok ? (
        <>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <SubmitButton className="w-full" pendingText="Sending…">Send reset link</SubmitButton>
        </>
      ) : null}
    </form>
  );
}
