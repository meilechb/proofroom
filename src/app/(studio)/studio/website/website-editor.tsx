"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Site } from "@/lib/site/schema";
import { TEMPLATES, FONT_PAIRINGS } from "@/lib/site/schema";
import { discardDraftAction, publishSiteAction, saveDraftAction } from "./actions";
import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";

type Panel = "home" | "pages" | "appearance" | "seo" | "contact";
type Device = "desktop" | "tablet" | "phone";
const WIDTHS: Record<Device, number> = { desktop: 1280, tablet: 768, phone: 375 };

export function WebsiteEditor({ initialDraft, hasDraft, liveUrl }: { initialDraft: Site; hasDraft: boolean; liveUrl: string }) {
  const [draft, setDraft] = useState(initialDraft);
  const [panel, setPanel] = useState<Panel>("home");
  const [device, setDevice] = useState<Device>("desktop");
  const [saved, setSaved] = useState<"idle" | "saving" | "done">("idle");
  const [pubState, pubAction] = useActionState(publishSiteAction, initialActionState);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshPreview = useCallback(() => {
    const f = iframeRef.current;
    if (f) f.src = `/studio/website/preview?t=${Date.now()}`;
  }, []);

  // Debounced autosave (plan 14.23).
  const scheduleSave = useCallback((next: Site) => {
    setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await saveDraftAction(next);
      setSaved("done");
      refreshPreview();
    }, 800);
  }, [refreshPreview]);

  const set = useCallback((updater: (d: Site) => Site) => {
    setDraft((prev) => {
      const next = updater(structuredClone(prev));
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const errors = pubState.fields ?? {};

  return (
    <div className="grid lg:grid-cols-[minmax(340px,420px)_1fr] gap-0 h-[calc(100vh-4rem)] -m-6 lg:-m-8">
      {/* Editor column */}
      <div className="border-r border-line overflow-y-auto">
        <div className="sticky top-0 bg-surface border-b border-line px-4 py-3 flex items-center justify-between gap-2 z-10">
          <div className="flex gap-1 text-sm">
            {(["home", "pages", "appearance", "seo", "contact"] as Panel[]).map((p) => (
              <button key={p} onClick={() => setPanel(p)} className={panel === p ? "rounded-md bg-surface-2 px-2.5 py-1 font-medium capitalize" : "rounded-md px-2.5 py-1 text-ink-2 hover:text-ink capitalize"}>{p}</button>
            ))}
          </div>
          <span className="text-xs text-muted">{saved === "saving" ? "Saving…" : saved === "done" ? "Saved" : ""}</span>
        </div>

        <div className="p-4 space-y-5">
          {pubState.error ? (
            <div className="rounded-lg border border-danger/20 bg-danger-bg p-3 text-sm text-danger">
              <p className="font-medium">{pubState.error}</p>
              <ul className="mt-1 list-disc pl-5">{Object.values(errors).map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          ) : null}
          {pubState.ok ? <div className="rounded-lg border border-success/20 bg-success-bg p-3 text-sm text-success">{pubState.message}</div> : null}

          {panel === "home" ? <HomePanel draft={draft} set={set} /> : null}
          {panel === "pages" ? <PagesPanel draft={draft} set={set} /> : null}
          {panel === "appearance" ? <AppearancePanel draft={draft} set={set} /> : null}
          {panel === "seo" ? <SeoPanel draft={draft} set={set} /> : null}
          {panel === "contact" ? <ContactPanel draft={draft} set={set} /> : null}
        </div>
      </div>

      {/* Preview column */}
      <div className="bg-surface-2 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-line bg-surface">
          <div className="flex gap-1">
            {(["desktop", "tablet", "phone"] as Device[]).map((d) => (
              <button key={d} onClick={() => setDevice(d)} className={device === d ? "rounded-md bg-surface-2 px-2.5 py-1 text-xs font-medium capitalize" : "rounded-md px-2.5 py-1 text-xs text-ink-2 capitalize"}>{d}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <a href="/studio/website/reviews" className="btn-ghost btn-sm">Reviews</a>
            <a href="/studio/website/areas" className="btn-ghost btn-sm">Areas</a>
            <a href={liveUrl} target="_blank" rel="noopener" className="btn-ghost btn-sm">View live</a>
            {hasDraft ? <form action={discardDraftAction}><button className="btn-ghost btn-sm text-danger">Discard draft</button></form> : null}
            <form action={pubAction}><button className="btn-primary btn-sm">Publish</button></form>
          </div>
        </div>
        <div className="flex-1 overflow-auto grid place-items-start justify-center p-4">
          <iframe ref={iframeRef} src="/studio/website/preview" title="Website preview" className="bg-white shadow-card border border-line rounded-lg h-[80vh]" style={{ width: WIDTHS[device], maxWidth: "100%" }} />
        </div>
      </div>
    </div>
  );
}

// ---- Panels ----------------------------------------------------------------

function Field({ label, value, onChange, textarea, hint }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-line-2 bg-surface px-3 py-2 text-sm" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full h-10 rounded-lg border border-line-2 bg-surface px-3 text-sm" />
      )}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center justify-between gap-3 text-sm py-1.5"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" /></label>;
}

type SetFn = (updater: (d: Site) => Site) => void;

function HomePanel({ draft, set }: { draft: Site; set: SetFn }) {
  const h = draft.home;
  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted">Hero</legend>
        <Field label="Headline" value={h.hero.heading} onChange={(v) => set((d) => { d.home.hero.heading = v; return d; })} />
        <Field label="Subheading" value={h.hero.subheading} onChange={(v) => set((d) => { d.home.hero.subheading = v; return d; })} textarea />
        <Field label="Primary button label" value={h.hero.button.label} onChange={(v) => set((d) => { d.home.hero.button.label = v; return d; })} />
      </fieldset>
      <SectionBlock title="Intro" enabled={h.intro.enabled} onToggle={(v) => set((d) => { d.home.intro.enabled = v; return d; })}>
        <Field label="Heading" value={h.intro.heading} onChange={(v) => set((d) => { d.home.intro.heading = v; return d; })} />
        <Field label="Body" value={h.intro.body} onChange={(v) => set((d) => { d.home.intro.body = v; return d; })} textarea />
      </SectionBlock>
      <SectionBlock title="Packages" enabled={h.packages.enabled} onToggle={(v) => set((d) => { d.home.packages.enabled = v; return d; })}>
        <Field label="Heading" value={h.packages.heading} onChange={(v) => set((d) => { d.home.packages.heading = v; return d; })} />
        <Field label="Intro" value={h.packages.body} onChange={(v) => set((d) => { d.home.packages.body = v; return d; })} hint="Manage the packages themselves under Packages." />
      </SectionBlock>
      <SectionBlock title="Testimonials" enabled={h.testimonials.enabled} onToggle={(v) => set((d) => { d.home.testimonials.enabled = v; return d; })}>
        <Field label="Heading" value={h.testimonials.heading} onChange={(v) => set((d) => { d.home.testimonials.heading = v; return d; })} hint="Add reviews on the Reviews page." />
      </SectionBlock>
      <SectionBlock title="FAQ" enabled={h.faq.enabled} onToggle={(v) => set((d) => { d.home.faq.enabled = v; return d; })}>
        <Field label="Heading" value={h.faq.heading} onChange={(v) => set((d) => { d.home.faq.heading = v; return d; })} />
        <FaqEditor items={h.faq.items} onChange={(items) => set((d) => { d.home.faq.items = items; return d; })} />
      </SectionBlock>
      <SectionBlock title="Location" enabled={h.location.enabled} onToggle={(v) => set((d) => { d.home.location.enabled = v; return d; })}>
        <Field label="Heading" value={h.location.heading} onChange={(v) => set((d) => { d.home.location.heading = v; return d; })} />
        <Field label="Body" value={h.location.body} onChange={(v) => set((d) => { d.home.location.body = v; return d; })} textarea />
      </SectionBlock>
      <SectionBlock title="Closing call to action" enabled={h.cta.enabled} onToggle={(v) => set((d) => { d.home.cta.enabled = v; return d; })}>
        <Field label="Heading" value={h.cta.heading} onChange={(v) => set((d) => { d.home.cta.heading = v; return d; })} />
        <Field label="Body" value={h.cta.body} onChange={(v) => set((d) => { d.home.cta.body = v; return d; })} textarea />
      </SectionBlock>
    </div>
  );
}

function SectionBlock({ title, enabled, onToggle, children }: { title: string; enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-line p-3 space-y-3">
      <div className="flex items-center justify-between">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</legend>
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4" aria-label={`Show ${title}`} />
      </div>
      {enabled ? children : <p className="text-xs text-muted">Hidden.</p>}
    </fieldset>
  );
}

function FaqEditor({ items, onChange }: { items: { q: string; a: string }[]; onChange: (items: { q: string; a: string }[]) => void }) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="rounded-md border border-line p-2 space-y-1">
          <input value={it.q} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} placeholder="Question" className="w-full h-8 rounded border border-line-2 px-2 text-sm" />
          <textarea value={it.a} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} placeholder="Answer" rows={2} className="w-full rounded border border-line-2 px-2 py-1 text-sm" />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-xs text-muted hover:text-danger">Remove</button>
        </div>
      ))}
      {items.length < 12 ? <button type="button" onClick={() => onChange([...items, { q: "", a: "" }])} className="btn-secondary btn-sm">Add question</button> : null}
    </div>
  );
}

function PagesPanel({ draft, set }: { draft: Site; set: SetFn }) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Show these pages</legend>
      <Toggle label="Portfolio" checked={draft.portfolio.enabled} onChange={(v) => set((d) => { d.portfolio.enabled = v; return d; })} />
      <Toggle label="Pricing" checked={draft.pricing.enabled} onChange={(v) => set((d) => { d.pricing.enabled = v; return d; })} />
      <Toggle label="About" checked={draft.about.enabled} onChange={(v) => set((d) => { d.about.enabled = v; return d; })} />
      <Toggle label="Contact" checked={draft.contact.enabled} onChange={(v) => set((d) => { d.contact.enabled = v; return d; })} />
      <Toggle label="Book" checked={draft.book.enabled} onChange={(v) => set((d) => { d.book.enabled = v; return d; })} />
      <Toggle label="Your gallery (client login)" checked={draft.gallery.enabled} onChange={(v) => set((d) => { d.gallery.enabled = v; return d; })} />
      <Toggle label="Local area pages" checked={draft.areas.enabled} onChange={(v) => set((d) => { d.areas.enabled = v; return d; })} />
    </fieldset>
  );
}

function AppearancePanel({ draft, set }: { draft: Site; set: SetFn }) {
  const s = draft.settings;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium mb-2">Template</p>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((t) => (
            <button key={t} onClick={() => set((d) => { d.settings.template = t; return d; })} className={s.template === t ? "rounded-lg border-2 border-ink p-3 text-sm capitalize" : "rounded-lg border border-line-2 p-3 text-sm capitalize text-ink-2"}>{t}</button>
          ))}
        </div>
      </div>
      <label className="block"><span className="text-sm font-medium">Primary color</span><input type="color" value={s.colors.primary} onChange={(e) => set((d) => { d.settings.colors.primary = e.target.value; return d; })} className="mt-1 h-10 w-full rounded-lg border border-line-2" /></label>
      <label className="block"><span className="text-sm font-medium">Accent color</span><input type="color" value={s.colors.accent} onChange={(e) => set((d) => { d.settings.colors.accent = e.target.value; return d; })} className="mt-1 h-10 w-full rounded-lg border border-line-2" /></label>
      <div>
        <p className="text-sm font-medium mb-2">Base</p>
        <div className="flex gap-2">
          {(["light", "dark"] as const).map((b) => <button key={b} onClick={() => set((d) => { d.settings.colors.base = b; return d; })} className={s.colors.base === b ? "rounded-lg border-2 border-ink px-4 py-2 text-sm capitalize" : "rounded-lg border border-line-2 px-4 py-2 text-sm capitalize text-ink-2"}>{b}</button>)}
        </div>
      </div>
      <label className="block"><span className="text-sm font-medium">Font pairing</span>
        <select value={s.font} onChange={(e) => set((d) => { d.settings.font = e.target.value as Site["settings"]["font"]; return d; })} className="mt-1 w-full h-10 rounded-lg border border-line-2 px-3 text-sm capitalize">
          {FONT_PAIRINGS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </label>
      <Field label="Tagline" value={s.tagline} onChange={(v) => set((d) => { d.settings.tagline = v; return d; })} />
    </div>
  );
}

function SeoPanel({ draft, set }: { draft: Site; set: SetFn }) {
  return (
    <div className="space-y-4">
      <Field label="Site title" value={draft.seo.siteTitle} onChange={(v) => set((d) => { d.seo.siteTitle = v; return d; })} hint="Shown in the browser tab and search results." />
      <Field label="Site description" value={draft.seo.siteDescription} onChange={(v) => set((d) => { d.seo.siteDescription = v; return d; })} textarea hint="One or two sentences for search engines." />
    </div>
  );
}

function ContactPanel({ draft, set }: { draft: Site; set: SetFn }) {
  const f = draft.contact.form;
  return (
    <div className="space-y-1">
      <Toggle label="Show phone field" checked={f.showPhone} onChange={(v) => set((d) => { d.contact.form.showPhone = v; return d; })} />
      <Toggle label="Show preferred-date field" checked={f.showPreferredDate} onChange={(v) => set((d) => { d.contact.form.showPreferredDate = v; return d; })} />
      <Toggle label="Show package picker" checked={f.showPackagePicker} onChange={(v) => set((d) => { d.contact.form.showPackagePicker = v; return d; })} />
      <Field label="Thank-you message" value={f.successMessage} onChange={(v) => set((d) => { d.contact.form.successMessage = v; return d; })} textarea />
    </div>
  );
}
