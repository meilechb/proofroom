"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";
import { saveFavoriteEmailAction } from "../actions";

/** Opt-in email capture on the favourites page, so the studio can send a reminder. */
export function FavoriteReminder({ slug, current }: { slug: string; current: string | null }) {
  const [state, action] = useActionState(saveFavoriteEmailAction, initialActionState);

  if (current && !state.ok) {
    return <p className="mt-6 text-sm text-[var(--site-ink-2)]">We&apos;ll remind you about these at <strong>{current}</strong>.</p>;
  }

  return (
    <form action={action} className="mt-6 flex flex-wrap items-end gap-2">
      <input type="hidden" name="slug" value={slug} />
      <label className="text-sm">
        <span className="block mb-1 text-[var(--site-ink-2)]">Want a reminder about your favourites?</span>
        <input type="email" name="email" required placeholder="you@example.com" className="h-11 w-64 max-w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 text-sm" />
      </label>
      <button type="submit" className="h-11 rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] px-4 text-sm font-medium">Email me</button>
      {state.error ? <span className="w-full text-xs text-[var(--site-ink-2)]" role="alert">{state.error}</span> : null}
      {state.ok ? <span className="w-full text-xs text-[var(--site-ink-2)]" role="status">{state.message}</span> : null}
    </form>
  );
}
