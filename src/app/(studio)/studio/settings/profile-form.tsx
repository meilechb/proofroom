"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";
import { Field, Input, Textarea, Select } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { saveProfileAction } from "./profile-actions";

const CURRENCIES = ["usd", "eur", "gbp", "cad", "aud", "nzd", "chf", "sek", "dkk", "nok"];

type Values = { name: string; legal_name: string; email: string; phone: string; timezone: string; currency: string; address: string; business_hours: string };

export function ProfileForm({ values }: { values: Values }) {
  const [state, action] = useActionState(saveProfileAction, initialActionState);
  return (
    <form action={action} className="space-y-4 max-w-2xl">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Studio name" htmlFor="name" error={state.fields?.name}>
          <Input id="name" name="name" defaultValue={values.name} required />
        </Field>
        <Field label="Legal name" htmlFor="legal_name" hint="For contracts and receipts, if different.">
          <Input id="legal_name" name="legal_name" defaultValue={values.legal_name} />
        </Field>
        <Field label="Contact email" htmlFor="email" error={state.fields?.email} hint="Clients reply here; also your account email.">
          <Input id="email" name="email" type="email" defaultValue={values.email} required />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={values.phone} />
        </Field>
        <Field label="Timezone" htmlFor="timezone" error={state.fields?.timezone} hint="An IANA name like America/New_York.">
          <Input id="timezone" name="timezone" defaultValue={values.timezone} />
        </Field>
        <Field label="Currency" htmlFor="currency" error={state.fields?.currency}>
          <Select id="currency" name="currency" defaultValue={values.currency}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Address" htmlFor="address" hint="Shown on invoices and, if you enable it, your website.">
        <Textarea id="address" name="address" defaultValue={values.address} rows={2} />
      </Field>
      <Field label="Business hours" htmlFor="business_hours" hint="For example: Mon–Fri 9–5, weekends by appointment.">
        <Textarea id="business_hours" name="business_hours" defaultValue={values.business_hours} rows={2} />
      </Field>
      <SubmitButton>Save profile</SubmitButton>
    </form>
  );
}
