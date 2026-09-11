"use client";

import { useActionState, useState } from "react";
import type { Broadcast } from "@/lib/types";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { saveBroadcastAction } from "./actions";

export function BroadcastDialog({ broadcast, trigger, counts }: { broadcast?: Broadcast; trigger: "add" | "edit"; counts: { buyers: number; clients: number } }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveBroadcastAction, initialActionState);
  const [audience, setAudience] = useState<"buyers" | "clients">((broadcast?.filter?.audience as "clients") === "clients" ? "clients" : "buyers");
  const reach = audience === "clients" ? counts.clients : counts.buyers;

  return (
    <>
      {trigger === "add" ? (
        <Button onClick={() => setOpen(true)}>New broadcast</Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Edit</Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={broadcast ? "Edit broadcast" : "New broadcast"}>
        <form action={action} className="space-y-4" noValidate>
          {broadcast ? <input type="hidden" name="id" value={broadcast.id} /> : null}
          <FormMessage state={state} />
          <Field label="Audience" htmlFor="b-aud" hint={`${reach} recipient${reach === 1 ? "" : "s"} right now — people who have unsubscribed are always excluded.`}>
            <Select id="b-aud" name="audience" value={audience} onChange={(e) => setAudience(e.target.value as "buyers" | "clients")}>
              <option value="buyers">Store buyers ({counts.buyers})</option>
              <option value="clients">All clients ({counts.clients})</option>
            </Select>
          </Field>
          <Field label="Subject" htmlFor="b-subj" error={state.fields?.subject}><Input id="b-subj" name="subject" required defaultValue={broadcast?.subject} /></Field>
          <Field label="Message" htmlFor="b-body" error={state.fields?.body} hint="Plain text. An unsubscribe link is added automatically.">
            <Textarea id="b-body" name="body" rows={8} required defaultValue={broadcast?.body ?? ""} />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton>{broadcast ? "Save draft" : "Create draft"}</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
