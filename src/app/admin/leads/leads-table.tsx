"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Table, Th, Td, Badge } from "@/components/ui";
import { markLeadAction } from "./actions";

type Lead = { id: string; email: string; name: string | null; message: string | null; source: string | null; created_at: string; contacted_at: string | null };

export function LeadsTable({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toggle = (id: string, contacted: boolean) => start(async () => { await markLeadAction(id, contacted); router.refresh(); });
  return (
    <Table>
      <thead><tr><Th>Contact</Th><Th>Message</Th><Th>Source</Th><Th>When</Th><Th /></tr></thead>
      <tbody>
        {leads.map((l) => (
          <tr key={l.id} className={l.contacted_at ? "opacity-60" : ""}>
            <Td><div><p className="font-medium">{l.name || "—"}</p><p className="text-xs text-muted">{l.email}</p></div></Td>
            <Td><span className="text-xs text-ink-2 line-clamp-2">{l.message ?? ""}</span></Td>
            <Td><span className="text-xs text-muted">{l.source ?? "—"}</span></Td>
            <Td><span className="text-xs text-muted whitespace-nowrap">{new Date(l.created_at).toLocaleDateString()}</span></Td>
            <Td>
              {l.contacted_at
                ? <button type="button" disabled={pending} onClick={() => toggle(l.id, false)} className="text-xs"><Badge tone="success">Contacted</Badge></button>
                : <button type="button" disabled={pending} onClick={() => toggle(l.id, true)} className="text-xs text-brand hover:underline">Mark contacted</button>}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
