"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Badge } from "@/components/ui";
import { CopyButton } from "@/components/forms/copy-button";
import { createTokenAction, revokeTokenAction } from "./actions";

type Token = { id: string; name: string; token_prefix: string; last_used_at: string | null; revoked_at: string | null; created_at: string; created_by_name: string | null };

export function TokenManager({ tokens }: { tokens: Token[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const create = () => start(async () => {
    const r = await createTokenAction(name);
    if (r.ok) { setFresh(r.token); setName(""); setError(null); router.refresh(); }
    else setError(r.error);
  });
  const revoke = (id: string) => { if (!confirm("Revoke this token? Any Lightroom plugin using it stops working.")) return; start(async () => { await revokeTokenAction(id); router.refresh(); }); };

  return (
    <div className="space-y-5">
      {fresh ? (
        <div className="rounded-lg border border-success/30 bg-success-bg p-3">
          <p className="text-sm font-medium text-success">Your new token — copy it now, it is shown only once.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded bg-surface px-2 py-1.5 text-xs font-mono break-all">{fresh}</code>
            <CopyButton value={fresh} />
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-48">
          <span className="text-sm font-medium">New token name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My laptop Lightroom" className="mt-1" />
        </label>
        <Button onClick={create} disabled={pending}>{pending ? "Creating…" : "Create token"}</Button>
      </div>

      {tokens.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-medium flex items-center gap-2">{t.name} {t.revoked_at ? <Badge tone="danger">Revoked</Badge> : null}</p>
                <p className="text-xs text-muted"><span className="font-mono">{t.token_prefix}…</span> · {t.last_used_at ? `last used ${new Date(t.last_used_at).toLocaleDateString()}` : "never used"}</p>
              </div>
              {!t.revoked_at ? <button type="button" disabled={pending} onClick={() => revoke(t.id)} className="text-xs text-muted hover:text-danger">Revoke</button> : null}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-ink-2">No tokens yet. Create one to connect the Lightroom plugin.</p>}
    </div>
  );
}
