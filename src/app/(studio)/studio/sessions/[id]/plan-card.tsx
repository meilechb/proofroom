"use client";

import { useState, useTransition } from "react";
import { Button, Card, Badge } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import type { PickerAsset } from "@/app/(studio)/studio/website/image-picker";
import { savePlanAction, sharePlanAction } from "./plan-actions";

type Shot = { id: string; text: string; done: boolean };
type Props = {
  orderId: string;
  initial: { notes_md: string; shot_list: Shot[]; mood_asset_ids: string[]; client_visible: boolean };
  assets: PickerAsset[];
  templates: Record<string, string[]>;
  printHref: string;
};

const uid = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function PlanCard({ orderId, initial, assets, templates, printHref }: Props) {
  const [notes, setNotes] = useState(initial.notes_md);
  const [shots, setShots] = useState<Shot[]>(initial.shot_list);
  const [mood, setMood] = useState<string[]>(initial.mood_asset_ids);
  const [visible, setVisible] = useState(initial.client_visible);
  const [add, setAdd] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const [sharing, startShare] = useTransition();

  const byId = new Map(assets.map((a) => [a.id, a]));
  const moodAssets = mood.map((id) => byId.get(id)).filter(Boolean) as PickerAsset[];

  const addShot = (text: string) => { const t = text.trim(); if (!t) return; setShots((prev) => (prev.some((s) => s.text.toLowerCase() === t.toLowerCase()) ? prev : [...prev, { id: uid(), text: t, done: false }])); };
  const insertTemplate = (key: string) => (templates[key] ?? []).forEach(addShot);
  const move = (i: number, d: number) => setShots((prev) => { const n = [...prev]; const j = i + d; if (j < 0 || j >= n.length) return prev; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const save = () => { setMsg(null); startSave(async () => { const r = await savePlanAction(orderId, { notes_md: notes, shot_list: shots, mood_asset_ids: mood, client_visible: visible }); setMsg(r.ok ? { ok: true, text: r.message ?? "Saved." } : { ok: false, text: r.error ?? "Could not save." }); }); };
  const share = () => { setMsg(null); startShare(async () => { const r = await sharePlanAction(orderId); if (r.ok) setVisible(true); setMsg(r.ok ? { ok: true, text: r.message ?? "Shared." } : { ok: false, text: r.error ?? "Could not share." }); }); };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Session plan</h2>
        <div className="flex items-center gap-2">
          {visible ? <Badge tone="success">Shared</Badge> : <Badge tone="neutral">Private</Badge>}
          <a href={printHref} target="_blank" rel="noopener" className="btn-secondary btn-sm">Print</a>
        </div>
      </div>
      {msg ? <p className={`mt-3 text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p> : null}

      <div className="mt-4 space-y-5">
        <div>
          <label className="text-sm font-medium" htmlFor="plan-notes">Notes</label>
          <textarea id="plan-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Markdown: brief, wardrobe, locations, must-haves…" className="mt-1 w-full rounded-lg border border-line-2 bg-surface px-3 py-2 text-sm font-mono" />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Shot list</span>
            <span className="text-xs text-muted">{shots.filter((s) => s.done).length}/{shots.length} done</span>
          </div>
          <ul className="mt-2 space-y-1">
            {shots.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={s.done} onChange={() => setShots((prev) => prev.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))} className="h-4 w-4" />
                <span className={`flex-1 ${s.done ? "line-through text-muted" : ""}`}>{s.text}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-muted hover:text-ink disabled:opacity-30" aria-label="Move up">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === shots.length - 1} className="text-muted hover:text-ink disabled:opacity-30" aria-label="Move down">↓</button>
                <button type="button" onClick={() => setShots((prev) => prev.filter((x) => x.id !== s.id))} className="text-muted hover:text-danger" aria-label="Remove">✕</button>
              </li>
            ))}
            {shots.length === 0 ? <li className="text-sm text-muted">Nothing yet. Add shots below or insert a template.</li> : null}
          </ul>
          <div className="mt-2 flex gap-2">
            <input value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addShot(add); setAdd(""); } }} placeholder="Add a shot and press Enter" className="flex-1 h-9 rounded-lg border border-line-2 bg-surface px-3 text-sm" />
            <button type="button" onClick={() => { addShot(add); setAdd(""); }} className="btn-secondary btn-sm">Add</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="text-muted">Templates:</span>
            {Object.keys(templates).map((k) => <button key={k} type="button" onClick={() => insertTemplate(k)} className="text-brand hover:underline capitalize">{k}</button>)}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Mood board</span>
            <button type="button" onClick={() => setPickOpen(true)} className="btn-secondary btn-sm">Choose images</button>
          </div>
          {moodAssets.length ? (
            <ul className="mt-2 grid grid-cols-4 sm:grid-cols-6 gap-2">
              {moodAssets.map((a) => (
                <li key={a.id} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.thumb} alt={a.alt || a.filename} className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
                  <button type="button" onClick={() => setMood((prev) => prev.filter((id) => id !== a.id))} className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-ink text-surface text-xs opacity-0 group-hover:opacity-100" aria-label="Remove">✕</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No reference images yet. <a href="/studio/assets" className="underline">Upload to Assets</a>, then choose them here.</p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="h-4 w-4" />
          Visible to the client in their portal
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save plan"}</Button>
          <Button variant="secondary" onClick={share} disabled={sharing}>{sharing ? "Sharing…" : "Share and email client"}</Button>
        </div>
      </div>

      <Dialog open={pickOpen} onClose={() => setPickOpen(false)} title="Mood board images">
        {assets.length === 0 ? (
          <p className="text-sm text-ink-2">No images yet. Upload some under Assets, then come back.</p>
        ) : (
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[55vh] overflow-y-auto">
            {assets.map((a) => {
              const on = mood.includes(a.id);
              return (
                <li key={a.id}>
                  <button type="button" onClick={() => setMood((prev) => (on ? prev.filter((id) => id !== a.id) : [...prev, a.id]))} className={`relative block w-full aspect-square overflow-hidden rounded-lg border-2 ${on ? "border-brand" : "border-transparent hover:border-line-2"}`} title={a.filename}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.thumb} alt={a.alt || a.filename} loading="lazy" className="h-full w-full object-cover" />
                    {on ? <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-brand text-white text-xs">✓</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 flex justify-end"><Button onClick={() => setPickOpen(false)}>Done</Button></div>
      </Dialog>
    </Card>
  );
}
