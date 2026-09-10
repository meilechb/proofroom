"use client";

import { useActionState, useState, useTransition } from "react";
import { initialActionState } from "@/lib/action-state";
import { Field, Input, Button } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { addEmailDomainAction, setFromLocalPartAction, testEmailDomainAction } from "./actions";

export function AddDomainForm({ suggestion }: { suggestion: string }) {
  const [state, action] = useActionState(addEmailDomainAction, initialActionState);
  return (
    <form action={action} className="space-y-3 max-w-md">
      <FormMessage state={state} />
      <Field label="Sending domain" htmlFor="domain" error={state.fields?.domain} hint="A subdomain you own is best, for example mail.yourstudio.com. It keeps your main domain's reputation separate.">
        <Input id="domain" name="domain" defaultValue={suggestion} placeholder="mail.yourstudio.com" autoComplete="off" spellCheck={false} />
      </Field>
      <SubmitButton>Add domain</SubmitButton>
    </form>
  );
}

export function LocalPartForm({ localPart, domain }: { localPart: string; domain: string }) {
  const [state, action] = useActionState(setFromLocalPartAction, initialActionState);
  return (
    <form action={action} className="space-y-2">
      <FormMessage state={state} />
      <div className="flex items-end gap-2">
        <label className="block">
          <span className="text-sm font-medium">Send from</span>
          <div className="mt-1 flex items-center">
            <input name="local_part" defaultValue={localPart} className="h-10 w-32 rounded-l-lg border border-line-2 bg-surface px-3 text-sm" aria-label="From address local part" />
            <span className="h-10 inline-flex items-center rounded-r-lg border border-l-0 border-line-2 bg-surface-2 px-3 text-sm text-muted">@{domain}</span>
          </div>
        </label>
        <SubmitButton variant="secondary">Save</SubmitButton>
      </div>
    </form>
  );
}

export function TestSendButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await testEmailDomainAction(); setMsg(r.ok ? r.message ?? "Sent." : r.error ?? "Could not send."); })}>Send test</Button>
      {msg ? <span className="text-xs text-ink-2">{msg}</span> : null}
    </div>
  );
}
