"use client";

import { useActionState } from "react";
import { unlockGalleryAction } from "./actions";
import { initialActionState } from "@/lib/action-state";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function UnlockForm({ slug, gslug, method }: { slug: string; gslug: string; method: "code" | "password" }) {
  const [state, action] = useActionState(unlockGalleryAction, initialActionState);
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={action} className="w-full max-w-sm">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="gslug" value={gslug} />
      <label htmlFor="unlock" className="block text-sm font-medium mb-1.5">{method === "password" ? "Password" : "Access code"}</label>
      <input id="unlock" name="code" autoComplete="off" autoFocus required className="w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 h-11 text-[var(--site-ink)]" placeholder={method === "password" ? "Enter the password" : "6-character code"} />
      {state.error ? <p className="mt-2 text-sm text-red-500" role="alert">{state.error}</p> : null}
      <button type="submit" className="mt-4 w-full h-11 rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] font-medium">Open gallery</button>
    </form>
  );
}
