"use client";

import { useActionState } from "react";
import { requestHubLinkAction } from "./actions";
import { initialActionState } from "@/lib/action-state";

export function RequestHubLink({ slug }: { slug: string }) {
  const [state, action] = useActionState(requestHubLinkAction, initialActionState);
  if (state.ok) return <p className="text-sm text-[var(--site-ink-2)]">{state.message}</p>;
  return (
    <form action={action} className="flex flex-col gap-2 w-full max-w-sm mx-auto">
      <input type="hidden" name="slug" value={slug} />
      <input name="email" type="email" required placeholder="you@example.com" className="w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 h-11" />
      {state.error ? <p className="text-sm text-red-500">{state.error}</p> : null}
      <button type="submit" className="h-11 rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] font-medium">Send me a link</button>
    </form>
  );
}
