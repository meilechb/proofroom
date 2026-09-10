"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";
import { Field, Input } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { saveDomainAction } from "./actions";

export function DomainForm() {
  const [state, action] = useActionState(saveDomainAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <Field label="Your domain" htmlFor="domain" error={state.fields?.domain} hint="Use your root domain, for example yourstudio.com. You buy it from a registrar like Namecheap or Google Domains; we do not sell domains.">
        <Input id="domain" name="domain" placeholder="yourstudio.com" autoComplete="off" spellCheck={false} />
      </Field>
      <SubmitButton>Add domain</SubmitButton>
    </form>
  );
}
