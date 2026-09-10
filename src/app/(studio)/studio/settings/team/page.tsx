import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { listMembers, listPendingInvites } from "@/lib/team";
import { Card } from "@/components/ui";
import { InviteForm } from "./invite-form";
import { TeamManager } from "./team-manager";

export const metadata: Metadata = { title: "Team" };

/** Members, invitations, roles and ownership (plan 17.4). */
export default async function TeamSettingsPage() {
  const ctx = await requireStudioPage("admin");
  const [members, invites] = await Promise.all([listMembers(ctx.studio.id), listPendingInvites(ctx.studio.id)]);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-medium mb-1">Invite a teammate</h2>
        <p className="text-sm text-ink-2 mb-4">Admins manage everything except billing and deleting the studio. Members work with clients, sessions and galleries.</p>
        <InviteForm />
      </Card>
      <Card>
        <h2 className="font-medium mb-4">Team</h2>
        <TeamManager members={members} invites={invites} currentUserId={ctx.user.id} currentUserRole={ctx.role} />
      </Card>
    </div>
  );
}
