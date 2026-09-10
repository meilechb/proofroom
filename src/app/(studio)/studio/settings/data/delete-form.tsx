"use client";

import { useActionState, useState } from "react";
import { initialActionState } from "@/lib/action-state";
import { Input } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { useFormStatus } from "react-dom";
import { deleteStudioAction } from "./actions";

function DangerButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={!enabled || pending} className="btn-sm rounded-lg bg-danger px-3 text-white disabled:opacity-40">{pending ? "Deleting…" : "Delete this studio"}</button>;
}

export function DeleteStudioForm({ studioName }: { studioName: string }) {
  const [state, action] = useActionState(deleteStudioAction, initialActionState);
  const [typed, setTyped] = useState("");
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <p className="text-sm text-ink-2">This cancels your subscription, disconnects Stripe and schedules your data for deletion. It cannot be undone. Type <strong>{studioName}</strong> to confirm.</p>
      <Input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={studioName} aria-label="Type the studio name to confirm" className="max-w-sm" />
      <DangerButton enabled={typed === studioName} />
    </form>
  );
}
