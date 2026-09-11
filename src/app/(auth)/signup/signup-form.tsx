"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { signupAction } from "../actions";
import { initialActionState } from "@/lib/action-state";
import { normalizeSlug } from "@/lib/slug";
import { appDomain } from "@/lib/env";
import { Field, Input } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { GoogleAuthButton } from "../google-auth";

export function SignupForm({ refCode = "", googleHref }: { refCode?: string; googleHref?: string }) {
  const [state, action] = useActionState(signupAction, initialActionState);
  const [studioName, setStudioName] = useState(state.values?.studioName ?? "");
  const [slug, setSlug] = useState(state.values?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [check, setCheck] = useState<{ ok: boolean; message: string } | null>(null);
  const domain = appDomain();
  // The browser's timezone is written straight into the hidden input after mount
  // (no state: the server render has no way to know it and must not guess).
  const timezoneRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      if (timezoneRef.current) timezoneRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    } catch {
      // leave empty; the server falls back to the default zone
    }
  }, []);

  // Debounced availability check. State resets happen in the change handlers,
  // not here, so the effect only schedules the network call.
  useEffect(() => {
    if (slug.length < 3) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/slug-check?slug=${encodeURIComponent(slug)}`);
        setCheck(await res.json());
      } catch {
        setCheck(null);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [slug]);

  function onStudioNameChange(value: string) {
    setStudioName(value);
    if (!slugTouched) {
      setSlug(normalizeSlug(value));
      setCheck(null);
    }
  }

  function onSlugChange(value: string) {
    setSlugTouched(true);
    setSlug(normalizeSlug(value));
    setCheck(null);
  }

  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <GoogleAuthButton label="Sign up with Google" href={googleHref} />
      <FormMessage state={state} />
      <input type="hidden" name="ref" value={refCode} />
      <input type="hidden" name="timezone" ref={timezoneRef} defaultValue="" />
      {/* Honeypot: hidden from people, filled by bots. */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <Field label="Your name" htmlFor="name" error={state.fields?.name}>
        <Input id="name" name="name" autoComplete="name" required defaultValue={state.values?.name} />
      </Field>
      <Field label="Email" htmlFor="email" error={state.fields?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={state.fields?.password} hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Field label="Studio or business name" htmlFor="studioName" error={state.fields?.studioName}>
        <Input id="studioName" name="studioName" required value={studioName} onChange={(e) => onStudioNameChange(e.target.value)} />
      </Field>
      <Field
        label="Your address"
        htmlFor="slug"
        error={state.fields?.slug ?? (check && !check.ok ? check.message : undefined)}
        hint={check?.ok ? `${slug}.${domain} is available. You can add your own domain later.` : `Clients will open galleries at name.${domain}.`}
      >
        <div className="flex items-center gap-2">
          <Input
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            className="flex-1"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="text-sm text-muted whitespace-nowrap">.{domain}</span>
        </div>
      </Field>
      <label className="flex items-start gap-2 text-sm text-ink-2">
        <input type="checkbox" name="terms" className="mt-1 h-4 w-4" required />
        <span>
          I agree to the <a href="/terms" className="underline" target="_blank">terms</a> and <a href="/privacy" className="underline" target="_blank">privacy policy</a>.
        </span>
      </label>
      {state.fields?.terms ? <p className="field-error">{state.fields.terms}</p> : null}
      <SubmitButton className="w-full" size="lg" pendingText="Creating your studio…">Create studio</SubmitButton>
    </form>
  );
}
