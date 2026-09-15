"use client";

import { useActionState, useMemo, useState } from "react";
import { initialActionState } from "@/lib/action-state";
import { renderAgreement, AGREEMENT_VARIABLES, type AgreementVars } from "@/lib/agreements";
import { markdownToHtml } from "@/lib/markdown-lite";
import { Field, Textarea, Button, cx } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { saveAgreementAction } from "./actions";

const VARIABLE_HELP: Record<AgreementVars extends Record<infer K, string> ? K : never, string> = {
  studio_name: "Your studio's name",
  studio_email: "Your contact email",
  client_name: "The client's name",
  session_title: "The session title",
  session_date: "The scheduled date, or 'a date agreed in writing'",
  price: "Session price after any discount",
  deposit: "Deposit amount",
  balance: "Balance after the deposit",
  included_finals: "Number of included final photos",
  extra_final_price: "Price of each extra final",
  retention_days: "How long galleries stay online",
};

export function AgreementForm({ initial, sample }: { initial: string; sample: AgreementVars }) {
  const [state, action] = useActionState(saveAgreementAction, initialActionState);
  const [body, setBody] = useState(initial);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const previewHtml = useMemo(() => markdownToHtml(renderAgreement(body, sample)), [body, sample]);
  const dirty = body.trim() !== initial.trim();

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div>
        <FormMessage state={state} />
        <div className="flex gap-1 border-b border-line mb-3" role="tablist" aria-label="Editor">
          {(["edit", "preview"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("px-3 py-2 text-sm border-b-2 -mb-px", tab === t ? "border-ink text-ink font-medium" : "border-transparent text-ink-2 hover:text-ink")}>
              {t === "edit" ? "Edit" : "Preview"}
            </button>
          ))}
        </div>
        {tab === "edit" ? (
          <Field label="Agreement (Markdown)" htmlFor="body_md" error={state.fields?.body_md} hint="Use ## for section headings, **bold** for emphasis and {{variables}} for details filled in per session.">
            <Textarea id="body_md" name="body_md" value={body} onChange={(e) => setBody(e.target.value)} rows={28} className="font-mono text-[13px] leading-relaxed" required />
          </Field>
        ) : (
          <>
            <input type="hidden" name="body_md" value={body} />
            <div className="card card-pad changelog agreement-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            <p className="mt-2 text-xs text-muted">Preview uses sample values. Clients see their own session details.</p>
          </>
        )}
        <div className="mt-4 flex items-center gap-3">
          <SubmitButton disabled={!dirty}>Save as new version</SubmitButton>
          {dirty ? <Button type="button" variant="secondary" onClick={() => setBody(initial)}>Discard changes</Button> : null}
        </div>
      </div>
      <aside className="text-sm">
        <h3 className="font-medium">Variables</h3>
        <p className="mt-1 text-ink-2 text-xs">Click one to insert it at the end of your text.</p>
        <ul className="mt-3 space-y-2">
          {AGREEMENT_VARIABLES.map((v) => (
            <li key={v}>
              <button type="button" onClick={() => setBody((b) => `${b.replace(/\s+$/, "")} {{${v}}}`)} className="font-mono text-xs rounded bg-surface-2 px-1.5 py-0.5 hover:bg-line">{`{{${v}}}`}</button>
              <div className="text-xs text-ink-2 mt-0.5">{VARIABLE_HELP[v]}</div>
            </li>
          ))}
        </ul>
      </aside>
    </form>
  );
}
