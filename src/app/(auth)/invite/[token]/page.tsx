import type { Metadata } from "next";
import { db, one } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { findUserByEmail } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/env";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Accept invitation", robots: { index: false } };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const invite = one<{ email: string; role: string; studio_name: string }>(
    await db()`
      select i.email, i.role, s.name as studio_name
      from invitations i join studios s on s.id = i.studio_id
      where i.token_hash = ${hashToken(token)} and i.accepted_at is null and i.expires_at > now() limit 1`
  );
  if (!invite) {
    return (
      <div className="card card-pad">
        <h1 className="text-xl font-semibold">Invitation not found</h1>
        <p className="mt-2 text-sm text-ink-2">This invitation is invalid or has expired. Ask the studio owner to send a new one.</p>
      </div>
    );
  }
  const current = await getCurrentUser();
  const existing = await findUserByEmail(invite.email);
  const mode: "signed_in" | "existing" | "new" =
    current && current.email.toLowerCase() === invite.email.toLowerCase() ? "signed_in" : existing ? "existing" : "new";
  return (
    <div className="card card-pad">
      <h1 className="text-xl font-semibold">Join {invite.studio_name}</h1>
      <p className="mt-1 text-sm text-ink-2">
        You were invited as {invite.role === "admin" ? "an admin" : "a member"} on {APP_NAME}. This invitation is for <strong>{invite.email}</strong>.
      </p>
      <InviteForm token={token} mode={mode} />
    </div>
  );
}
