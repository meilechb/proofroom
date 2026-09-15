"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";
import { resendLibraryAction } from "./actions";

export function ResendForm({ slug }: { slug: string }) {
  const [state, action] = useActionState(resendLibraryAction, initialActionState);
  return (
    <form action={action} className="mt-6 space-y-3">
      <input type="hidden" name="slug" value={slug} />
      {state.error ? <p className="text-sm" style={{ color: "#c0392b" }} role="alert">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-[var(--site-ink-2)]" role="status">{state.message}</p> : null}
      <input type="email" name="email" required placeholder="you@example.com" className="w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 h-11 text-sm" />
      <button type="submit" className="inline-flex items-center justify-center rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] px-4 h-11 text-sm font-medium w-full">Email me my download link</button>
    </form>
  );
}
