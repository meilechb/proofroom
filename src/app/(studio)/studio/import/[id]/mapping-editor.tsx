"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Button } from "@/components/ui";
import { startImportAction } from "../actions";

type Gallery = { fileId: string; folder: string; title: string; kind: "proof" | "final"; include: boolean; files: string[] };
type ClientOpt = { id: string; name: string; email: string };
type Row = Gallery & { clientSel: string; newName: string; newEmail: string };

/** Review step: edit titles, kinds, and assign or create a client per gallery (plan 21.2). */
export function MappingEditor({ importId, galleries, clients }: { importId: string; galleries: Gallery[]; clients: ClientOpt[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(galleries.map((g) => ({ ...g, clientSel: "", newName: g.title, newEmail: "" })));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = () => {
    setError(null);
    const edited = rows.map((r) => {
      const base = { folder: r.folder, fileId: r.fileId, title: r.title.trim() || r.folder, kind: r.kind, include: r.include };
      if (r.clientSel && r.clientSel !== "new") return { ...base, clientId: r.clientSel };
      if (r.clientSel === "new") return { ...base, clientId: null, clientName: r.newName.trim() || base.title, clientEmail: r.newEmail.trim() };
      return { ...base, clientId: null };
    });
    start(async () => {
      const res = await startImportAction(importId, edited);
      if (res.ok) router.refresh();
      else setError(res.error ?? "Could not start the import.");
    });
  };

  const totalPhotos = rows.filter((r) => r.include).reduce((n, r) => n + r.files.length, 0);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Review {rows.length} galleries</h2>
        <span className="text-sm text-muted">{totalPhotos} photos to import</span>
      </div>
      <p className="mt-1 text-sm text-ink-2">Edit titles, choose proofs or finals, and assign a client. Galleries are created as drafts.</p>

      <div className="mt-4 space-y-3">
        {rows.map((r, i) => (
          <div key={`${r.fileId}-${r.folder}`} className={`rounded-xl border border-line p-3 ${r.include ? "" : "opacity-50"}`}>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={r.include} onChange={(e) => set(i, { include: e.target.checked })} className="h-4 w-4" /> Import</label>
              <input value={r.title} onChange={(e) => set(i, { title: e.target.value })} className="flex-1 min-w-[12rem] h-9 rounded-lg border border-line-2 bg-surface px-3 text-sm" placeholder="Gallery title" />
              <select value={r.kind} onChange={(e) => set(i, { kind: e.target.value as "proof" | "final" })} className="h-9 rounded-lg border border-line-2 bg-surface px-2 text-sm">
                <option value="proof">Proofs</option>
                <option value="final">Finals</option>
              </select>
              <span className="text-xs text-muted">{r.files.length} photos</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select value={r.clientSel} onChange={(e) => set(i, { clientSel: e.target.value })} className="h-9 rounded-lg border border-line-2 bg-surface px-2 text-sm">
                <option value="">— Client from title —</option>
                <option value="new">＋ New client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
              </select>
              {r.clientSel === "new" ? (
                <>
                  <input value={r.newName} onChange={(e) => set(i, { newName: e.target.value })} placeholder="Client name" className="h-9 rounded-lg border border-line-2 bg-surface px-3 text-sm" />
                  <input value={r.newEmail} onChange={(e) => set(i, { newEmail: e.target.value })} placeholder="Client email" type="email" className="h-9 rounded-lg border border-line-2 bg-surface px-3 text-sm" />
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={submit} disabled={pending || rows.every((r) => !r.include)}>{pending ? "Starting…" : "Start import"}</Button>
        <span className="text-xs text-muted">Runs in the background; you can leave this page.</span>
      </div>
    </Card>
  );
}
