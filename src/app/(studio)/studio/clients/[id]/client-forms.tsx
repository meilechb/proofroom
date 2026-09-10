"use client";

import { useActionState, useState } from "react";
import type { Client } from "@/lib/types";
import { clientStages, clientStageLabels } from "@/lib/types";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { addNoteAction, logInteractionAction, setStageAction, updateClientAction } from "../actions";

export function StageSelect({ client }: { client: Client }) {
  return (
    <form action={setStageAction}>
      <input type="hidden" name="id" value={client.id} />
      <Select name="stage" defaultValue={client.stage} className="w-44 h-9" aria-label="Stage" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {clientStages.map((s) => <option key={s} value={s}>{clientStageLabels[s]}</option>)}
      </Select>
    </form>
  );
}

export function EditClientButton({ client }: { client: Client }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(updateClientAction, initialActionState);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Edit</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Edit client">
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="id" value={client.id} />
          <FormMessage state={state} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="e-name" error={state.fields?.name}><Input id="e-name" name="name" required defaultValue={client.name} /></Field>
            <Field label="Email" htmlFor="e-email" error={state.fields?.email}><Input id="e-email" name="email" type="email" required defaultValue={client.email} /></Field>
            <Field label="Phone" htmlFor="e-phone" error={state.fields?.phone}><Input id="e-phone" name="phone" type="tel" defaultValue={client.phone ?? ""} /></Field>
            <Field label="Company" htmlFor="e-company" error={state.fields?.company}><Input id="e-company" name="company" defaultValue={client.company ?? ""} /></Field>
          </div>
          <Field label="Tags" htmlFor="e-tags" hint="Comma-separated."><Input id="e-tags" name="tags" defaultValue={client.tags.join(", ")} /></Field>
          <Field label="Private notes" htmlFor="e-notes" hint="Only your team sees these."><Textarea id="e-notes" name="notes" rows={3} defaultValue={client.notes ?? ""} /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton>Save</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function TimelineComposer({ clientId }: { clientId: string }) {
  const [tab, setTab] = useState<"note" | "log">("note");
  const [noteState, noteAction] = useActionState(addNoteAction, initialActionState);
  const [logState, logAction] = useActionState(logInteractionAction, initialActionState);
  return (
    <div className="card card-pad">
      <div className="flex gap-1 mb-3">
        <button type="button" onClick={() => setTab("note")} className={tab === "note" ? "btn-secondary btn-sm" : "btn-ghost btn-sm"}>Add note</button>
        <button type="button" onClick={() => setTab("log")} className={tab === "log" ? "btn-secondary btn-sm" : "btn-ghost btn-sm"}>Log call or meeting</button>
      </div>
      {tab === "note" ? (
        <form action={noteAction} className="space-y-2">
          <input type="hidden" name="id" value={clientId} />
          <FormMessage state={noteState} />
          <Textarea name="body" rows={2} placeholder="Add a note about this client…" aria-label="Note" required />
          <div className="flex justify-end"><SubmitButton size="sm">Add note</SubmitButton></div>
        </form>
      ) : (
        <form action={logAction} className="space-y-2">
          <input type="hidden" name="id" value={clientId} />
          <FormMessage state={logState} />
          <div className="flex gap-2">
            <Select name="kind" defaultValue="call" className="w-32 h-9" aria-label="Kind">
              <option value="call">Call</option>
              <option value="meeting">Meeting</option>
              <option value="email">Email</option>
            </Select>
            <Input name="summary" placeholder="What was discussed" aria-label="Summary" required className="flex-1" />
          </div>
          <div className="flex justify-end"><SubmitButton size="sm">Log it</SubmitButton></div>
        </form>
      )}
    </div>
  );
}
