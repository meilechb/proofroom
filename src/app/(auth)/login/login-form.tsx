"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";
import { initialActionState } from "@/lib/action-state";
import { Field, Input } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { GoogleAuthButton } from "../google-auth";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, initialActionState);
  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <GoogleAuthButton label="Sign in with Google" />
      <FormMessage state={state} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} autoFocus />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
