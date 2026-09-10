"use client";

import { useActionState, useState } from "react";
import { createGalleryAction } from "./actions";
import { initialActionState } from "@/lib/action-state";
import { Button, Field, Input, Select } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

type ClientOpt = { id: string; name: string };

export function NewGalleryButton({ clients, presetClientId, presetOrderId, open: initialOpen }: { clients: ClientOpt[]; presetClientId?: string; presetOrderId?: string; open?: boolean }) {
  const [open, setOpen] = useState(Boolean(initialOpen));
  const [state, action] = useActionState(createGalleryAction, initialActionState);
  return (
    <>
      <Button onClick={() => setOpen(true)}>New gallery</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New gallery">
        <form action={action} className="space-y-4" noValidate>
          {presetOrderId ? <input type="hidden" name="orderId" value={presetOrderId} /> : null}
          <FormMessage state={state} />
          <Field label="Client" htmlFor="g-client" error={state.fields?.clientId}>
            <Select id="g-client" name="clientId" defaultValue={presetClientId ?? ""} required>
              <option value="" disabled>Choose a client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Kind" htmlFor="g-kind" hint="Proofs let clients favorite and comment. Finals are downloadable.">
            <Select id="g-kind" name="kind" defaultValue="proof">
              <option value="proof">Proofs (for selection)</option>
              <option value="final">Finals (for download)</option>
            </Select>
          </Field>
          <Field label="Title" htmlFor="g-title" hint="Optional; defaults to the client name and today's date."><Input id="g-title" name="title" /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pendingText="Creating…">Create gallery</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
