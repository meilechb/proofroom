"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { unlockTeamAction } from "./actions";
import { initialActionState } from "@/lib/action-state";

export function ManagerUnlock({ slug, eventSlug }: { slug: string; eventSlug: string }) {
  const [state, action] = useActionState(unlockTeamAction, initialActionState);
  const router = useRouter();
  useEffect(() => { if (state.ok) router.refresh(); }, [state, router]);
  return (
    <form action={action} className="w-full max-w-sm mx-auto">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="eventSlug" value={eventSlug} />
      <label htmlFor="mc" className="block text-sm font-medium mb-1.5">Manager code</label>
      <input id="mc" name="code" required autoFocus className="w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 h-11" />
      {state.error ? <p className="mt-2 text-sm text-red-500">{state.error}</p> : null}
      <button type="submit" className="mt-4 w-full h-11 rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] font-medium">View the day</button>
    </form>
  );
}
