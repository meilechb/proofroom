"use client";

import { useState, useTransition } from "react";
import { Drawer } from "@/components/ui/dialog";
import { Badge, Button, Table, Th, Td } from "@/components/ui";
import { getEmailDetailAction, resendEmailAction } from "./actions";

export type LogRow = {
  id: string; to_address: string; subject: string; status: string; template_key: string | null; last_event: string | null; created_at: string;
  delivered_at: string | null; opened_at: string | null; clicked_at: string | null; bounced_at: string | null; complained_at: string | null;
};
type Detail = LogRow & { body: string | null; error: string | null; kind: string | null };

function statusTone(status: string, row: Pick<LogRow, "bounced_at" | "complained_at">): "neutral" | "success" | "warning" | "danger" {
  if (row.complained_at || row.bounced_at) return "danger";
  if (status === "failed") return "danger";
  if (status === "skipped") return "warning";
  return "success";
}

function eventLabel(row: LogRow) {
  if (row.complained_at) return "Complained";
  if (row.bounced_at) return "Bounced";
  if (row.clicked_at) return "Clicked";
  if (row.opened_at) return "Opened";
  if (row.delivered_at) return "Delivered";
  if (row.status === "sent") return "Sent";
  if (row.status === "skipped") return "Skipped";
  return "Failed";
}

export function EmailLogTable({ rows }: { rows: LogRow[] }) {
  const [active, setActive] = useState<LogRow | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (active && loadedFor !== active.id) {
    setLoadedFor(active.id);
    setDetail(null);
    setMsg(null);
    void getEmailDetailAction(active.id).then((d) => setDetail(d as Detail | null));
  }

  const resend = () => { if (!active) return; start(async () => { const r = await resendEmailAction(active.id); setMsg(r.ok ? r.message ?? "Resent." : r.error ?? "Could not resend."); }); };

  return (
    <>
      <Table>
        <thead><tr><Th>Recipient</Th><Th>Subject</Th><Th>Template</Th><Th>Status</Th><Th>When</Th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="cursor-pointer hover:bg-surface-2" onClick={() => setActive(r)}>
              <Td><span className="truncate">{r.to_address}</span></Td>
              <Td><span className="truncate">{r.subject}</span></Td>
              <Td><span className="text-xs text-muted">{r.template_key ?? "—"}</span></Td>
              <Td><Badge tone={statusTone(r.status, r)}>{eventLabel(r)}</Badge></Td>
              <Td><span className="text-xs text-muted">{new Date(r.created_at).toLocaleString()}</span></Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Drawer open={Boolean(active)} onClose={() => setActive(null)} title="Email">
        {active ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="col-span-2"><dt className="text-muted text-xs">To</dt><dd>{active.to_address}</dd></div>
              <div className="col-span-2"><dt className="text-muted text-xs">Subject</dt><dd>{active.subject}</dd></div>
              <div><dt className="text-muted text-xs">Status</dt><dd><Badge tone={statusTone(active.status, active)}>{eventLabel(active)}</Badge></dd></div>
              <div><dt className="text-muted text-xs">Sent</dt><dd>{new Date(active.created_at).toLocaleString()}</dd></div>
            </dl>

            <ul className="text-xs text-ink-2 space-y-1">
              {active.delivered_at ? <li>Delivered {new Date(active.delivered_at).toLocaleString()}</li> : null}
              {active.opened_at ? <li>Opened {new Date(active.opened_at).toLocaleString()}</li> : null}
              {active.clicked_at ? <li>Clicked {new Date(active.clicked_at).toLocaleString()}</li> : null}
              {active.bounced_at ? <li className="text-danger">Bounced {new Date(active.bounced_at).toLocaleString()}</li> : null}
              {active.complained_at ? <li className="text-danger">Marked as spam {new Date(active.complained_at).toLocaleString()}</li> : null}
            </ul>

            {detail?.error ? <p className="rounded-lg border border-danger/20 bg-danger-bg p-2 text-xs text-danger">{detail.error}</p> : null}

            <div>
              <p className="text-xs text-muted mb-1">Message</p>
              <div className="rounded-lg border border-line bg-surface-2 p-3 text-sm whitespace-pre-line max-h-72 overflow-y-auto">
                {detail === null ? "Loading…" : detail.body || <span className="text-muted">No stored body.</span>}
              </div>
            </div>

            {msg ? <p className="text-sm text-ink-2">{msg}</p> : null}
            <Button size="sm" variant="secondary" onClick={resend} disabled={pending || !detail?.body}>{pending ? "Resending…" : "Resend"}</Button>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
