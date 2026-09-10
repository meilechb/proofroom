"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";
import { Field, Input } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { saveSenderNameAction } from "./actions";

export function SenderForm({ fromName, replyTo, fromAddress }: { fromName: string; replyTo: string; fromAddress: string | null }) {
  const [state, action] = useActionState(saveSenderNameAction, initialActionState);
  return (
    <form action={action} className="space-y-3 max-w-lg">
      <FormMessage state={state} />
      <Field label="From name" htmlFor="from_name" hint="Shown as the sender name on emails to your clients.">
        <Input id="from_name" name="from_name" defaultValue={fromName} maxLength={80} />
      </Field>
      <dl className="grid gap-2 sm:grid-cols-2 text-sm">
        <div><dt className="text-muted text-xs">From address</dt><dd>{fromAddress ? <span className="font-mono text-xs">{fromAddress}</span> : <span className="text-ink-2">Our shared address until you verify your own on the Email domain tab.</span>}</dd></div>
        <div><dt className="text-muted text-xs">Reply-to</dt><dd className="font-mono text-xs">{replyTo}</dd></div>
      </dl>
      <SubmitButton variant="secondary">Save</SubmitButton>
    </form>
  );
}
