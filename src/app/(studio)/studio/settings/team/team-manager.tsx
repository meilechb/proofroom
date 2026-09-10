"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Table, Th, Td } from "@/components/ui";
import { changeRoleAction, removeMemberAction, transferOwnershipAction, resendInviteAction, revokeInviteAction } from "./actions";

type Member = { user_id: string; name: string; email: string; role: "owner" | "admin" | "member"; last_login_at: string | null };
type Invite = { id: string; email: string; role: string; expires_at: string };

export function TeamManager({ members, invites, currentUserId, currentUserRole }: { members: Member[]; invites: Invite[]; currentUserId: string; currentUserRole: "owner" | "admin" | "member" }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isOwner = currentUserRole === "owner";

  const run = (fn: () => Promise<{ ok?: boolean; error?: string } | void>) => start(async () => {
    const r = await fn();
    if (r && "error" in r && r.error) setMsg(r.error); else { setMsg(null); router.refresh(); }
  });

  return (
    <div className="space-y-6">
      {msg ? <p className="rounded-lg border border-danger/20 bg-danger-bg p-3 text-sm text-danger">{msg}</p> : null}

      <Table>
        <thead><tr><Th>Member</Th><Th>Role</Th><Th>Last sign-in</Th><Th className="w-0" /></tr></thead>
        <tbody>
          {members.map((m) => {
            const self = m.user_id === currentUserId;
            return (
              <tr key={m.user_id}>
                <Td><div><p className="font-medium">{m.name || m.email}{self ? " (you)" : ""}</p><p className="text-xs text-muted">{m.email}</p></div></Td>
                <Td>
                  {m.role === "owner" ? <Badge tone="brand">Owner</Badge> : (
                    <select
                      defaultValue={m.role}
                      disabled={pending}
                      onChange={(e) => run(() => changeRoleAction(m.user_id, e.target.value as "admin" | "member"))}
                      className="h-8 rounded border border-line-2 bg-surface px-2 text-sm"
                      aria-label={`Role for ${m.email}`}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                </Td>
                <Td><span className="text-xs text-muted">{m.last_login_at ? new Date(m.last_login_at).toLocaleDateString() : "Never"}</span></Td>
                <Td>
                  <div className="flex justify-end gap-2 text-xs">
                    {isOwner && m.role !== "owner" ? (
                      <button type="button" disabled={pending} onClick={() => { if (confirm(`Make ${m.name || m.email} the owner? You become an admin.`)) run(() => transferOwnershipAction(m.user_id)); }} className="text-muted hover:text-ink">Make owner</button>
                    ) : null}
                    {m.role !== "owner" && !self ? (
                      <button type="button" disabled={pending} onClick={() => { if (confirm(`Remove ${m.name || m.email} from the team?`)) run(() => removeMemberAction(m.user_id)); }} className="text-muted hover:text-danger">Remove</button>
                    ) : null}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {invites.length ? (
        <div>
          <h3 className="font-medium text-sm mb-2">Pending invitations</h3>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div><span>{i.email}</span> <Badge>{i.role}</Badge></div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted">Expires {new Date(i.expires_at).toLocaleDateString()}</span>
                  <button type="button" disabled={pending} onClick={() => run(() => resendInviteAction(i.id))} className="text-muted hover:text-ink">Resend</button>
                  <button type="button" disabled={pending} onClick={() => run(() => revokeInviteAction(i.id))} className="text-muted hover:text-danger">Revoke</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
