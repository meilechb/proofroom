"use client";

import { useActionState, useState } from "react";
import { initialActionState } from "@/lib/action-state";
import { Button, Card, Field, Input } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionToast } from "@/components/ui/toast";
import { changePasswordAction, deleteAccountAction, requestEmailChangeAction, updateNameAction } from "./actions";

export function AccountForms({ user }: { user: { name: string; email: string } }) {
  const [nameState, nameAction] = useActionState(updateNameAction, initialActionState);
  const [emailState, emailAction] = useActionState(requestEmailChangeAction, initialActionState);
  const [pwState, pwAction] = useActionState(changePasswordAction, initialActionState);
  const [delState, delAction] = useActionState(deleteAccountAction, initialActionState);
  const [showDelete, setShowDelete] = useState(false);
  useActionToast(nameState);
  useActionToast(pwState);
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-medium">Your name</h2>
        <form action={nameAction} className="mt-3 flex flex-col sm:flex-row gap-3 sm:items-end">
          <Field label="Name" htmlFor="name" error={nameState.fields?.name} className="flex-1"><Input id="name" name="name" defaultValue={user.name} required /></Field>
          <SubmitButton variant="secondary">Save</SubmitButton>
        </form>
      </Card>
      <Card>
        <h2 className="font-medium">Email</h2>
        <p className="mt-1 text-sm text-ink-2">Current: <strong>{user.email}</strong>. We send a confirmation link to the new address before anything changes.</p>
        <form action={emailAction} className="mt-3 space-y-3">
          <FormMessage state={emailState} />
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <Field label="New email" htmlFor="email" error={emailState.fields?.email} className="flex-1"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
            <SubmitButton variant="secondary" pendingText="Sending…">Send confirmation</SubmitButton>
          </div>
        </form>
      </Card>
      <Card>
        <h2 className="font-medium">Password</h2>
        <form action={pwAction} className="mt-3 space-y-3">
          <FormMessage state={pwState} />
          <Field label="Current password" htmlFor="current" error={pwState.fields?.current}><Input id="current" name="current" type="password" autoComplete="current-password" required /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="New password" htmlFor="password" error={pwState.fields?.password} hint="At least 10 characters."><Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} /></Field>
            <Field label="Repeat new password" htmlFor="confirm" error={pwState.fields?.confirm}><Input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></Field>
          </div>
          <SubmitButton variant="secondary" pendingText="Changing…">Change password</SubmitButton>
        </form>
      </Card>
      <Card className="border-danger/30">
        <h2 className="font-medium text-danger">Delete account</h2>
        <p className="mt-1 text-sm text-ink-2">Removes your sign-in. Studios you own must be handed to another owner or deleted first.</p>
        {!showDelete ? (
          <Button type="button" variant="secondary" className="mt-3" onClick={() => setShowDelete(true)}>Delete my account…</Button>
        ) : (
          <form action={delAction} className="mt-3 space-y-3">
            <FormMessage state={delState} />
            <Field label={`Type ${user.email} to confirm`} htmlFor="confirm-delete" error={delState.fields?.confirm}><Input id="confirm-delete" name="confirm" autoComplete="off" required /></Field>
            <div className="flex gap-2">
              <SubmitButton variant="danger" pendingText="Deleting…">Delete account</SubmitButton>
              <Button type="button" variant="ghost" onClick={() => setShowDelete(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
