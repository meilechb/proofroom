"use client";

import { useActionState } from "react";
import { tenantContactAction } from "./actions";
import { initialActionState } from "@/lib/action-state";

type PackageOpt = { id: string; name: string };

export function ContactForm({ slug, packages, showPackagePicker, showPhone, showPreferredDate, successMessage }: { slug: string; packages: PackageOpt[]; showPackagePicker: boolean; showPhone: boolean; showPreferredDate: boolean; successMessage: string }) {
  const [state, action] = useActionState(tenantContactAction, initialActionState);
  if (state.ok) return <div className="rounded-xl border border-[var(--site-line)] p-6 text-center"><p className="font-medium">{successMessage || state.message}</p></div>;
  const v = state.values ?? {};
  const field = "w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 h-11";
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="slug" value={slug} />
      {state.error ? <p className="text-sm text-red-500" role="alert">{state.error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">Name<input name="name" required defaultValue={v.name} className={`mt-1 ${field}`} />{state.fields?.name ? <span className="text-red-500 text-xs">{state.fields.name}</span> : null}</label>
        <label className="block text-sm">Email<input name="email" type="email" required defaultValue={v.email} className={`mt-1 ${field}`} />{state.fields?.email ? <span className="text-red-500 text-xs">{state.fields.email}</span> : null}</label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {showPhone ? <label className="block text-sm">Phone<input name="phone" type="tel" defaultValue={v.phone} className={`mt-1 ${field}`} /></label> : null}
        {showPreferredDate ? <label className="block text-sm">Preferred date<input name="preferredDate" type="date" className={`mt-1 ${field}`} /></label> : null}
      </div>
      {showPackagePicker && packages.length ? (
        <label className="block text-sm">Package<select name="packageId" defaultValue="" className={`mt-1 ${field}`}><option value="">Not sure yet</option>{packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      ) : null}
      <label className="block text-sm">Message<textarea name="message" required rows={5} defaultValue={v.message} className="mt-1 w-full rounded-lg border border-[var(--site-line)] bg-[var(--site-bg)] px-3 py-2" />{state.fields?.message ? <span className="text-red-500 text-xs">{state.fields.message}</span> : null}</label>
      <div className="hidden" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <button type="submit" className="h-11 px-6 rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] font-medium">Send</button>
    </form>
  );
}
