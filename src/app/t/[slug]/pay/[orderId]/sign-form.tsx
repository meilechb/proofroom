"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { signAgreementAction } from "./actions";
import { initialActionState } from "@/lib/action-state";

export function SignForm({ slug, orderId, agreementText }: { slug: string; orderId: string; agreementText: string }) {
  const [state, action] = useActionState(signAgreementAction, initialActionState);
  const router = useRouter();
  useEffect(() => { if (state.ok) router.refresh(); }, [state, router]);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="orderId" value={orderId} />
      <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--site-line)] bg-[var(--site-bg-2)] p-4 text-sm whitespace-pre-wrap leading-relaxed">{agreementText}</div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="agree" className="mt-1 h-4 w-4" required /> I have read and agree to this agreement.</label>
      <label className="flex items-start gap-2 text-sm text-[var(--site-ink-2)]"><input type="checkbox" name="portfolio" className="mt-1 h-4 w-4" /> I allow my photos to be used in the studio&rsquo;s portfolio (optional).</label>
      <div>
        <label htmlFor="sign-name" className="block text-sm font-medium mb-1">Type your full name to sign</label>
        <input id="sign-name" name="name" required className="w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 h-11" />
      </div>
      {state.error ? <p className="text-sm text-red-500" role="alert">{state.error}</p> : null}
      <button type="submit" className="w-full h-11 rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] font-medium">Agree and continue</button>
    </form>
  );
}
