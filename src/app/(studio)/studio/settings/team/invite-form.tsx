"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";
import { Input, Select, Button } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { useFormStatus } from "react-dom";
import { inviteMemberAction } from "./actions";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send invite"}</Button>;
}

export function InviteForm() {
  const [state, action] = useActionState(inviteMemberAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-48">
          <span className="text-sm font-medium">Email</span>
          <Input name="email" type="email" placeholder="teammate@example.com" aria-invalid={state.fields?.email ? true : undefined} className="mt-1" />
        </label>
        <label>
          <span className="text-sm font-medium">Role</span>
          <Select name="role" defaultValue="member" className="mt-1"><option value="member">Member</option><option value="admin">Admin</option></Select>
        </label>
        <SubmitBtn />
      </div>
    </form>
  );
}
