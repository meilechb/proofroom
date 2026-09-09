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
    const any = one<{ accepted_at: string | null; expires_at: string; studio_name: string }>(
      await db()`select i.accepted_at, i.expires_at, s.name as studio_name from invitations i join studios s on s.id = i.studio_id where i.token_hash = ${hashToken(token)} limit 1`
    );
    const title = any?.accepted_at ? "Invitation already used" : any ? "Invitation expired" : "Invitation not found";
    const body = any?.accepted_at
      ? `This invitation to ${any.studio_name} was already accepted. Sign in to open the studio.`
      : any
        ? `This invitation to ${any.studio_name} expired. Ask the studio owner to send a new one.`
        : "This invitation link is not valid. Check the link in your email or ask the studio owner to send a new one.";
    return (
      <div className="card card-pad">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-ink-2">{body}</p>
        {any?.accepted_at ? <p className="mt-4 text-sm"><a href="/login" className="underline">Sign in</a></p> : null}
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
