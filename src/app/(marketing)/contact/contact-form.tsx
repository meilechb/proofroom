"use client";

import { useActionState } from "react";
import { contactAction } from "./actions";
import { initialActionState } from "@/lib/action-state";
import { Field, Input, Textarea } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export function ContactForm() {
  const [state, action] = useActionState(contactAction, initialActionState);
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      {!state.ok ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" htmlFor="name" error={state.fields?.name}>
              <Input id="name" name="name" autoComplete="name" required defaultValue={v.name} aria-invalid={Boolean(state.fields?.name)} />
            </Field>
            <Field label="Email" htmlFor="email" error={state.fields?.email}>
              <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={v.email} aria-invalid={Boolean(state.fields?.email)} />
            </Field>
          </div>
          <Field label="Studio or website" htmlFor="studio" hint="Optional.">
            <Input id="studio" name="studio" autoComplete="organization" defaultValue={v.studio} />
          </Field>
          <Field label="Message" htmlFor="message" error={state.fields?.message}>
            <Textarea id="message" name="message" required rows={6} defaultValue={v.message} aria-invalid={Boolean(state.fields?.message)} />
          </Field>
          {/* Honeypot: hidden from people, filled by bots. */}
          <div className="hidden" aria-hidden>
            <label htmlFor="website">Website</label>
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>
          <SubmitButton pendingText="Sending…">Send message</SubmitButton>
        </>
      ) : null}
    </form>
  );
}
