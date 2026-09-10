"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";
import { Input } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { inviteReferralAction } from "./actions";

export function InviteForm() {
  const [state, action] = useActionState(inviteReferralAction, initialActionState);
  return (
    <form action={action} className="space-y-2 max-w-md">
      <FormMessage state={state} />
      <div className="flex gap-2">
        <Input name="email" type="email" placeholder="friend@studio.com" aria-label="Photographer's email" aria-invalid={state.fields?.email ? true : undefined} />
        <SubmitButton>Send invite</SubmitButton>
      </div>
    </form>
  );
}
