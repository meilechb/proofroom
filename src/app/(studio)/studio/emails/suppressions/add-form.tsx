"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";
import { Input } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { addSuppressionAction } from "./actions";

export function AddSuppressionForm() {
  const [state, action] = useActionState(addSuppressionAction, initialActionState);
  return (
    <form action={action} className="space-y-2 max-w-md">
      <FormMessage state={state} />
      <div className="flex gap-2">
        <Input name="email" type="email" placeholder="name@example.com" aria-label="Email to suppress" aria-invalid={state.fields?.email ? true : undefined} />
        <SubmitButton variant="secondary">Add</SubmitButton>
      </div>
    </form>
  );
}
