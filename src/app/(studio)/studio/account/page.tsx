import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { db, rows } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/types";
import { AccountForms } from "./forms";
import { revokeOtherSessionsAction, revokeSessionAction } from "./actions";

export const metadata: Metadata = { title: "Account" };

type SessionRow = { id: string; user_agent: string | null; ip: string | null; created_at: string; last_seen_at: string };

export default async function AccountPage({ searchParams }: PageProps<"/studio/account">) {
  const ctx = await requireStudioPage();
  const sp = await searchParams;
  const sessions = rows<SessionRow>(await db()`select id, user_agent, ip, created_at, last_seen_at from sessions where user_id = ${ctx.user.id} and expires_at > now() order by last_seen_at desc`);
  return (
    <div className="max-w-2xl">
      <PageHeader title="Account" description="Your sign-in details. Studio settings live under Settings." />
      {sp.email === "changed" ? <p className="mb-4 rounded-lg border border-success/20 bg-success-bg px-4 py-3 text-sm text-success">Your email address was changed.</p> : null}
      {sp.email === "invalid" ? <p className="mb-4 rounded-lg border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">That confirmation link is invalid or has expired. Request the change again.</p> : null}
      <AccountForms user={{ name: ctx.user.name, email: ctx.user.email }} />
      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Signed-in devices</h2>
          {sessions.length > 1 ? (
            <form action={revokeOtherSessionsAction}><button className="btn-secondary btn-sm">Sign out other devices</button></form>
          ) : null}
        </div>
        <ul className="mt-3 divide-y divide-line text-sm">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 py-2">
              <div className="min-w-0">
                <p className="truncate">{describeAgent(s.user_agent)}{s.id === ctx.user.session_id ? <span className="ml-2 badge-brand">This device</span> : null}</p>
                <p className="text-xs text-muted">Last active {formatDate(s.last_seen_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{s.ip ? ` · ${s.ip}` : ""}</p>
              </div>
              <form action={revokeSessionAction}>
                <input type="hidden" name="sessionId" value={s.id} />
                <button className="btn-ghost btn-sm">{s.id === ctx.user.session_id ? "Sign out" : "Revoke"}</button>
              </form>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function describeAgent(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) && !/Chrome/.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}
