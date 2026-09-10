"use client";

import { useActionState, useRef } from "react";
import { createTaskAction } from "./actions";
import { initialActionState } from "@/lib/action-state";
import { Input } from "@/components/ui";
import { SubmitButton } from "@/components/forms/submit-button";

export function NewTaskForm() {
  const [state, action] = useActionState(createTaskAction, initialActionState);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await action(fd);
        ref.current?.reset();
      }}
      className="card card-pad flex flex-col sm:flex-row gap-2"
    >
      <Input name="title" placeholder="Add a task…" required aria-label="Task" className="flex-1" />
      <Input name="due_on" type="date" aria-label="Due date" className="sm:w-44" />
      <SubmitButton>Add</SubmitButton>
      {state.error ? <p className="field-error w-full">{state.error}</p> : null}
    </form>
  );
}
