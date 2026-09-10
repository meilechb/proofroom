"use client";

import { useActionState, useRef } from "react";
import { addReviewAction } from "./actions";
import { initialActionState } from "@/lib/action-state";
import { Button, Field, Input, Textarea, Select } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export function AddReviewForm() {
  const [state, action] = useActionState(addReviewAction, initialActionState);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={async (fd) => { await action(fd); ref.current?.reset(); }} className="card card-pad space-y-3">
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" htmlFor="r-name"><Input id="r-name" name="name" required /></Field>
        <Field label="Source" htmlFor="r-source" hint="e.g. Google"><Input id="r-source" name="source" /></Field>
        <Field label="Rating" htmlFor="r-rating"><Select id="r-rating" name="rating" defaultValue="5">{[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} star{n===1?"":"s"}</option>)}</Select></Field>
      </div>
      <Field label="Review" htmlFor="r-body"><Textarea id="r-body" name="body" rows={3} required /></Field>
      <div className="flex justify-end"><SubmitButton>Add review</SubmitButton></div>
    </form>
  );
}

export { Button };
