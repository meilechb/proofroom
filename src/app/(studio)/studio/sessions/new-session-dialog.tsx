"use client";

import { useActionState, useState } from "react";
import { createSessionAction } from "./actions";
import { initialActionState } from "@/lib/action-state";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { MoneyField, DateTimeField } from "@/components/ui/fields";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

type ClientOpt = { id: string; name: string; email: string };
type PackageOpt = { id: string; name: string };

export function NewSessionButton({ clients, packages, timezone, presetClientId, open: initialOpen }: {
  clients: ClientOpt[];
  packages: PackageOpt[];
  timezone: string;
  presetClientId?: string;
  open?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(initialOpen));
  const [state, action] = useActionState(createSessionAction, initialActionState);
  const [mode, setMode] = useState<"existing" | "new">(clients.length ? "existing" : "new");

  return (
    <>
      <Button onClick={() => setOpen(true)}>New session</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New session">
        <form action={action} className="space-y-4" noValidate>
          <FormMessage state={state} />
          <div>
            <div className="flex gap-1 mb-2">
              <button type="button" onClick={() => setMode("existing")} className={mode === "existing" ? "btn-secondary btn-sm" : "btn-ghost btn-sm"} disabled={clients.length === 0}>Existing client</button>
              <button type="button" onClick={() => setMode("new")} className={mode === "new" ? "btn-secondary btn-sm" : "btn-ghost btn-sm"}>New client</button>
            </div>
            {mode === "existing" ? (
              <Field label="Client" htmlFor="s-client">
                <Select id="s-client" name="clientId" defaultValue={presetClientId ?? ""} required>
                  <option value="" disabled>Choose a client</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                </Select>
              </Field>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="s-name" error={state.fields?.newName}><Input id="s-name" name="newName" /></Field>
                <Field label="Email" htmlFor="s-email" error={state.fields?.newEmail}><Input id="s-email" name="newEmail" type="email" /></Field>
              </div>
            )}
          </div>
          <Field label="Package" htmlFor="s-pkg" hint="Sets the price, deposit and included photos.">
            <Select id="s-pkg" name="packageId" defaultValue="">
              <option value="">No package</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="s-title" hint="Optional; defaults to the package name."><Input id="s-title" name="title" /></Field>
            <MoneyField name="discount" label="Discount" defaultCents={0} hint="Optional." />
          </div>
          <DateTimeField name="scheduledAt" label="Date and time" timeZone={timezone} hint="Optional; leave blank to schedule later." />
          <Field label="Location" htmlFor="s-loc"><Input id="s-loc" name="location" placeholder="Studio, or the client's office" /></Field>
          <Field label="Notes" htmlFor="s-notes"><Textarea id="s-notes" name="notes" rows={2} /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pendingText="Creating…">Create session</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
