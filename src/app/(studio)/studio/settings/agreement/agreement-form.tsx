"use client";

import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { AGREEMENT_VARIABLES, DEFAULT_AGREEMENT_MD, renderAgreement, unknownAgreementVariables, type AgreementVars } from "@/lib/agreements";
import { saveAgreementAction } from "./actions";

/** Sample values so the studio can see the contract as a client will read it. */
function sampleVars(studioName: string, studioEmail: string): AgreementVars {
  return {
    studio_name: studioName || "Your Studio",
    studio_email: studioEmail || "you@studio.com",
    client_name: "Jordan Lee",
    session_title: "Executive headshots",
    session_date: "March 3, 2026",
    price: "$250",
    deposit: "$100",
    balance: "$150",
    included_finals: "3",
    extra_final_price: "$40",
    retention_days: "90",
  };
}

/** Minimal Markdown preview: ## headings, **bold**, paragraphs. Mirrors the pay-page agreement. */
function AgreementPreview({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-ink-2">
      {blocks.map((block, i) => {
        const heading = block.match(/^##\s+(.*)$/);
        if (heading) return <h4 key={i} className="font-display text-base font-medium text-ink">{heading[1]}</h4>;
        const parts: ReactNode[] = [];
        const re = /\*\*(.*?)\*\*/g;
        let last = 0, m: RegExpExecArray | null, k = 0;
        while ((m = re.exec(block))) {
          if (m.index > last) parts.push(block.slice(last, m.index));
          parts.push(<strong key={k++} className="text-ink">{m[1]}</strong>);
          last = m.index + m[0].length;
        }
        parts.push(block.slice(last));
        return <p key={i}>{parts}</p>;
      })}
    </div>
  );
}

export function AgreementForm({ initialBody, version, studioName, studioEmail }: { initialBody: string; version: number | null; studioName: string; studioEmail: string }) {
  const [body, setBody] = useState(initialBody);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  const vars = useMemo(() => sampleVars(studioName, studioEmail), [studioName, studioEmail]);
  const unknown = useMemo(() => unknownAgreementVariables(body), [body]);
  const dirty = body !== initialBody;

  function insertVariable(name: string) {
    const el = ref.current;
    const token = `{{${name}}}`;
    if (!el) { setBody((b) => b + token); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + token.length; });
  }

  const save = () => start(async () => {
    const r = await saveAgreementAction(body);
    setMsg(r.ok ? { ok: true, text: r.message ?? "Saved." } : { ok: false, text: r.error ?? "Could not save." });
  });

  return (
    <div className="space-y-5">
      {msg ? (
        <div className={msg.ok ? "rounded-lg border border-success/20 bg-success-bg p-3 text-sm text-success-fg" : "rounded-lg border border-danger/20 bg-danger-bg p-3 text-sm text-danger-fg"}>{msg.text}</div>
      ) : null}

      <div>
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <span className="label !mb-0">Agreement (Markdown)</span>
          <span className="text-xs text-muted">{version ? `Current: version ${version}` : "No version saved yet"}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {AGREEMENT_VARIABLES.map((v) => (
            <button key={v} type="button" onClick={() => insertVariable(v)} className="badge-neutral hover:bg-brand/10 hover:text-brand transition-colors" title={`Insert {{${v}}}`}>
              {`{{${v}}}`}
            </button>
          ))}
        </div>
        <textarea ref={ref} value={body} onChange={(e) => setBody(e.target.value)} rows={18} spellCheck className="textarea font-mono text-[13px] leading-relaxed" aria-label="Agreement Markdown" />
        {unknown.length > 0 ? (
          <p className="field-error mt-1.5">Unknown variable{unknown.length > 1 ? "s" : ""}: {unknown.map((u) => `{{${u}}}`).join(", ")}. These will show literally to clients.</p>
        ) : (
          <p className="hint">Click a chip to insert a variable. Use <code className="font-mono">## Heading</code> and <code className="font-mono">**bold**</code>.</p>
        )}
      </div>

      <div>
        <span className="eyebrow">Preview</span>
        <div className="mt-2 max-h-96 overflow-y-auto rounded-xl border border-line bg-surface-2 p-5">
          <AgreementPreview markdown={renderAgreement(body, vars)} />
        </div>
        <p className="hint">Sample values shown; each session fills in its own client, dates and amounts.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={pending || unknown.length > 0 || !dirty}>{pending ? "Saving…" : "Save new version"}</Button>
        <button type="button" onClick={() => setBody(DEFAULT_AGREEMENT_MD)} className="btn-ghost" disabled={pending}>Reset to default</button>
        {dirty ? <span className="text-xs text-muted">Unsaved changes</span> : null}
      </div>
    </div>
  );
}
