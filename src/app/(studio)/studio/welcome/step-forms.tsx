"use client";

import { useActionState, useState } from "react";
import type { Package } from "@/lib/types";
import { Field, Input } from "@/components/ui";
import { ColorField } from "@/components/ui/fields";
import { MoneyField } from "@/components/ui/fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { CopyButton } from "@/components/forms/copy-button";
import { initialActionState } from "@/lib/action-state";
import { createWizardTokenAction, saveBrandAction, saveEmailSenderAction, savePackagesAction } from "./actions";

export function BrandForm({ name, color, logoUrl }: { name: string; color: string; logoUrl: string | null }) {
  const [state, action] = useActionState(saveBrandAction, initialActionState);
  const [preview, setPreview] = useState<string | null>(logoUrl);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field label="Studio name" htmlFor="name" error={state.fields?.name} hint="Shown on your galleries, emails and website.">
        <Input id="name" name="name" defaultValue={state.values?.name ?? name} required aria-invalid={Boolean(state.fields?.name)} />
      </Field>
      <div>
        <span className="label">Logo</span>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-lg border border-line bg-surface-2 flex items-center justify-center overflow-hidden">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Logo preview" className="h-full w-full object-contain" />
            ) : (
              <span className="text-2xl font-semibold text-muted">{name.charAt(0).toUpperCase() || "S"}</span>
            )}
          </div>
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            className="text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : logoUrl);
            }}
          />
        </div>
        {state.fields?.logo ? <p className="field-error">{state.fields.logo}</p> : <p className="hint">PNG, JPEG, WebP, GIF or SVG, up to 5 MB. Optional; you can add it later.</p>}
      </div>
      <ColorField name="color" label="Brand color" defaultValue={color} hint="Used for buttons and accents on your gallery and site." />
      <div className="flex justify-end">
        <SubmitButton>Save and continue</SubmitButton>
      </div>
    </form>
  );
}

export function PackagesForm({ packages }: { packages: Package[] }) {
  const [state, action] = useActionState(savePackagesAction, initialActionState);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <div className="space-y-4">
        {packages.map((p) => (
          <div key={p.id} className="card card-pad">
            <input type="hidden" name="id" value={p.id} />
            <div className="flex items-start justify-between gap-4">
              <Field label="Name" htmlFor={`name_${p.id}`} error={state.fields?.[`name_${p.id}`]} className="flex-1">
                <Input id={`name_${p.id}`} name={`name_${p.id}`} defaultValue={p.name} required />
              </Field>
              <label className="flex items-center gap-2 text-sm mt-8 whitespace-nowrap">
                <input type="checkbox" name={`active_${p.id}`} defaultChecked={p.is_active} className="h-4 w-4" /> Show to clients
              </label>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MoneyField name={`price_${p.id}`} label="Price" defaultCents={p.price_cents} />
              <MoneyField name={`deposit_${p.id}`} label="Deposit" defaultCents={p.deposit_cents} />
              <Field label="Photos included" htmlFor={`included_${p.id}`} error={state.fields?.[`included_${p.id}`]}>
                <Input id={`included_${p.id}`} name={`included_${p.id}`} type="number" min={0} defaultValue={p.included_finals} inputMode="numeric" />
              </Field>
              <MoneyField name={`extra_${p.id}`} label="Each extra photo" defaultCents={p.extra_final_cents} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <SubmitButton>Save and continue</SubmitButton>
      </div>
    </form>
  );
}

export function EmailSenderForm({ fromName, replyTo }: { fromName: string; replyTo: string }) {
  const [state, action] = useActionState(saveEmailSenderAction, initialActionState);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field label="From name" htmlFor="fromName" error={state.fields?.fromName} hint="What clients see in their inbox. Usually your studio name.">
        <Input id="fromName" name="fromName" defaultValue={state.values?.fromName ?? fromName} required />
      </Field>
      <Field label="Reply-to email" htmlFor="replyTo" error={state.fields?.replyTo} hint="Where client replies go. Verify your own sending domain later in settings.">
        <Input id="replyTo" name="replyTo" type="email" defaultValue={state.values?.replyTo ?? replyTo} required />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>Save and continue</SubmitButton>
      </div>
    </form>
  );
}

export function TokenForm() {
  const [state, action] = useActionState(createWizardTokenAction, initialActionState);
  const token = state.ok ? state.message : null;
  return (
    <form action={action} className="space-y-4">
      {token ? (
        <div className="rounded-lg border border-success/30 bg-success-bg p-4">
          <p className="text-sm font-medium text-success">Token created. Copy it now; it is shown only once.</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-surface px-3 py-2 text-xs font-mono border border-line">{token}</code>
            <CopyButton value={token} />
          </div>
          <p className="mt-3 text-xs text-ink-2">Paste it into the plugin in Lightroom&apos;s Plug-in Manager. You can create more tokens in settings.</p>
        </div>
      ) : (
        <>
          {state.error ? <FormMessage state={state} /> : null}
          <p className="text-sm text-ink-2">Create a token for the Lightroom plugin now, or skip and do it later from settings.</p>
          <SubmitButton pendingText="Creating…" variant="secondary">Create a Lightroom token</SubmitButton>
        </>
      )}
    </form>
  );
}
