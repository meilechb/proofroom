"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { renderTemplate, type EmailTemplateDef, type TemplateValues } from "@/lib/email-templates";
import { globalVariables } from "@/lib/email-templates";
import { saveTemplateAction, resetTemplateAction, testSendTemplateAction } from "../actions";

/** Edit a template's subject and body, insert variables, preview with sample data, test send (plan 16.2). */
export function TemplateEditor({ def, initial, customized }: { def: EmailTemplateDef; initial: TemplateValues; customized: boolean }) {
  const router = useRouter();
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [cta, setCta] = useState(initial.cta_label ?? def.defaults.cta_label ?? "");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const variables = [...globalVariables, ...def.variables];

  const sample: Record<string, string> = { studio_name: "Your Studio", studio_email: "you@yourstudio.com", client_name: "Sarah Cohen", ...def.sample };

  const insert = (name: string) => {
    const el = bodyRef.current;
    const token = `{{${name}}}`;
    if (!el) { setBody((b) => b + token); return; }
    const start2 = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start2) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start2 + token.length; });
  };

  const values: TemplateValues = { subject, body, cta_label: def.hasCta ? cta : undefined };

  const save = () => start(async () => { const r = await saveTemplateAction(def.key, values); setMsg(r.ok ? { tone: "ok", text: r.message ?? "Saved." } : { tone: "err", text: r.error ?? "Could not save." }); if (r.ok) router.refresh(); });
  const test = () => start(async () => { const r = await testSendTemplateAction(def.key, values); setMsg(r.ok ? { tone: "ok", text: r.message ?? "Sent." } : { tone: "err", text: r.error ?? "Could not send." }); });
  const reset = () => { if (!confirm("Reset this template to the default wording?")) return; start(async () => { await resetTemplateAction(def.key); router.refresh(); router.push("/studio/emails"); }); };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        {msg ? <div className={msg.tone === "ok" ? "rounded-lg border border-success/20 bg-success-bg p-3 text-sm text-success" : "rounded-lg border border-danger/20 bg-danger-bg p-3 text-sm text-danger"}>{msg.text}</div> : null}

        <label className="block"><span className="text-sm font-medium">Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full h-10 rounded-lg border border-line-2 bg-surface px-3 text-sm" />
        </label>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Body</span>
            <span className="text-xs text-muted">Blank line = new paragraph</span>
          </div>
          <textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="mt-1 w-full rounded-lg border border-line-2 bg-surface px-3 py-2 text-sm font-mono" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {variables.map((v) => (
              <button key={v.name} type="button" onClick={() => insert(v.name)} title={v.description} className="rounded-full border border-line-2 px-2 py-0.5 text-xs text-ink-2 hover:border-brand hover:text-brand">
                {`{{${v.name}}}`}
              </button>
            ))}
          </div>
        </div>

        {def.hasCta ? (
          <label className="block"><span className="text-sm font-medium">Button label</span>
            <input value={cta} onChange={(e) => setCta(e.target.value)} className="mt-1 w-full h-10 rounded-lg border border-line-2 bg-surface px-3 text-sm" placeholder="e.g. View your gallery" />
          </label>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={save} disabled={pending}>{pending ? "Working…" : "Save"}</Button>
          <Button size="sm" variant="secondary" onClick={test} disabled={pending}>Send test to me</Button>
          {customized ? <Button size="sm" variant="ghost" onClick={reset} disabled={pending}>Reset to default</Button> : null}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Preview</p>
        <div className="rounded-lg border border-line bg-surface-2 p-4">
          <p className="text-sm font-semibold">{renderTemplate(subject, sample) || <span className="text-muted">No subject</span>}</p>
          <hr className="my-3 border-line" />
          <div className="whitespace-pre-line text-sm text-ink-2">{renderTemplate(body, sample)}</div>
          {def.hasCta && cta ? <div className="mt-4"><span className="inline-flex items-center rounded-lg bg-brand px-4 h-9 text-sm text-white">{cta}</span></div> : null}
        </div>
        <p className="mt-2 text-xs text-muted">Preview uses sample data. Variables are filled in for real when the email is sent.</p>
      </div>
    </div>
  );
}
