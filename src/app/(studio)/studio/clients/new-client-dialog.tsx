"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientAction } from "./actions";
import { initialActionState } from "@/lib/action-state";
import { Button, Field, Input, Select } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { clientStages, clientStageLabels } from "@/lib/types";

export function NewClientButton({ open: initialOpen }: { open?: boolean }) {
  const [open, setOpen] = useState(Boolean(initialOpen));
  const [state, action] = useActionState(createClientAction, initialActionState);
  const router = useRouter();

  useEffect(() => {
    if (state.ok && state.values?.id) router.push(`/studio/clients/${state.values.id}`);
  }, [state, router]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add client</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add a client">
        <form action={action} className="space-y-4" noValidate>
          <FormMessage state={state} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="c-name" error={state.fields?.name}>
              <Input id="c-name" name="name" required autoFocus defaultValue={state.values?.name} />
            </Field>
            <Field label="Email" htmlFor="c-email" error={state.fields?.email}>
              <Input id="c-email" name="email" type="email" required defaultValue={state.values?.email} />
            </Field>
            <Field label="Phone" htmlFor="c-phone" error={state.fields?.phone}>
              <Input id="c-phone" name="phone" type="tel" defaultValue={state.values?.phone} />
            </Field>
            <Field label="Company" htmlFor="c-company" error={state.fields?.company}>
              <Input id="c-company" name="company" defaultValue={state.values?.company} />
            </Field>
            <Field label="Stage" htmlFor="c-stage">
              <Select id="c-stage" name="stage" defaultValue="lead">
                {clientStages.filter((s) => s !== "archived").map((s) => <option key={s} value={s}>{clientStageLabels[s]}</option>)}
              </Select>
            </Field>
            <Field label="Tags" htmlFor="c-tags" hint="Comma-separated.">
              <Input id="c-tags" name="tags" placeholder="wedding, repeat" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton>Add client</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
