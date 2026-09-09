"use client";

import { useActionState } from "react";
import { acceptInviteAction } from "../../actions";
import { initialActionState } from "@/lib/action-state";
import { Field, Input } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export function InviteForm({ token, mode }: { token: string; mode: "signed_in" | "existing" | "new" }) {
  const [state, action] = useActionState(acceptInviteAction, initialActionState);
  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      {mode === "new" ? (
        <>
          <Field label="Your name" htmlFor="name">
            <Input id="name" name="name" required autoComplete="name" />
          </Field>
          <Field label="Choose a password" htmlFor="password" error={state.fields?.password} hint="At least 10 characters.">
            <Input id="password" name="password" type="password" required autoComplete="new-password" minLength={10} />
          </Field>
        </>
      ) : mode === "existing" ? (
        <Field label="Your password" htmlFor="password" hint="Sign in with the account that uses this email to accept.">
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </Field>
      ) : null}
      <SubmitButton className="w-full" pendingText="Joining…">Accept invitation</SubmitButton>
    </form>
  );
}
