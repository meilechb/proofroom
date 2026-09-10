"use client";

import { useActionState, useRef } from "react";
import { addAreaAction } from "./actions";
import { initialActionState } from "@/lib/action-state";
import { Field, Input, Textarea } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export function AddAreaForm() {
  const [state, action] = useActionState(addAreaAction, initialActionState);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={async (fd) => { await action(fd); ref.current?.reset(); }} className="card card-pad space-y-3">
      <FormMessage state={state} />
      <Field label="Town or city" htmlFor="a-town" hint="Creates a page at /headshots/<name>."><Input id="a-town" name="town" required /></Field>
      <Field label="Custom intro" htmlFor="a-intro" hint="Optional. Use {town} to insert the name. Leave blank to use the default pattern."><Textarea id="a-intro" name="intro" rows={2} /></Field>
      <div className="flex justify-end"><SubmitButton>Add area</SubmitButton></div>
    </form>
  );
}
