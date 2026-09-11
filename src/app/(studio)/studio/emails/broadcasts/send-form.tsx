"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { startBroadcastAction } from "./actions";

/** Send-now / schedule a draft, surfacing the result (e.g. "no recipients"). */
export function SendForm({ id }: { id: string }) {
  const [state, action] = useActionState(startBroadcastAction, initialActionState);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
      <input type="hidden" name="id" value={id} />
      <label className="text-xs text-muted">Schedule (optional)<input type="datetime-local" name="scheduledAt" className="block mt-0.5 rounded-lg border border-line bg-surface px-2 h-9 text-sm" /></label>
      <SubmitButton>Send / schedule</SubmitButton>
      <span className="text-xs text-muted">Leave the time empty to send now.</span>
      {state.error ? <span className="w-full text-xs text-danger" role="alert">{state.error}</span> : null}
      {state.ok ? <span className="w-full text-xs text-success" role="status">{state.message}</span> : null}
    </form>
  );
}
