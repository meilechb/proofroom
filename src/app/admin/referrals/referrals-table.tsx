"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Table, Th, Td, Badge } from "@/components/ui";
import { voidReferralAction, reactivateReferralAction } from "./actions";

type Row = { id: string; code: string; status: string; referred_email: string | null; referrer_name: string | null; referred_name: string | null; rewarded_at: string | null; void_reason: string | null; created_at: string };

const TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "brand"> = { invited: "neutral", signed_up: "brand", rewarded: "success", void: "danger" };

export function ReferralsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<void>) => start(async () => { await fn(); router.refresh(); });
  return (
    <Table>
      <thead><tr><Th>Referrer</Th><Th>Referred</Th><Th>Code</Th><Th>Status</Th><Th>When</Th><Th /></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td><span className="text-sm">{r.referrer_name ?? "—"}</span></Td>
            <Td><div className="text-sm">{r.referred_name ?? "—"}<div className="text-xs text-muted">{r.referred_email ?? ""}</div></div></Td>
            <Td><span className="font-mono text-xs">{r.code}</span></Td>
            <Td><Badge tone={TONE[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</Badge></Td>
            <Td><span className="text-xs text-muted whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</span></Td>
            <Td>
              {r.status === "void"
                ? <button type="button" disabled={pending} onClick={() => act(() => reactivateReferralAction(r.id))} className="text-xs text-brand hover:underline">Re-grant</button>
                : <button type="button" disabled={pending} onClick={() => { if (confirm("Void this referral?")) act(() => voidReferralAction(r.id)); }} className="text-xs text-muted hover:text-danger">Void</button>}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
