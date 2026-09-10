import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { listMembers, listPendingInvites } from "@/lib/team";
import { Card } from "@/components/ui";
import { UpgradeLock } from "@/components/studio/upgrade-lock";
import { InviteForm } from "./invite-form";
import { TeamManager } from "./team-manager";

export const metadata: Metadata = { title: "Team" };

/** Members, invitations, roles and ownership (plan 17.4). */
export default async function TeamSettingsPage() {
  const ctx = await requireStudioPage("admin");
  const [members, invites] = await Promise.all([listMembers(ctx.studio.id), listPendingInvites(ctx.studio.id)]);
  const canAddSeats = ctx.entitlements.maxSeats === null || members.length < ctx.entitlements.maxSeats;

  return (
    <div className="space-y-6">
      {canAddSeats ? (
        <Card>
          <h2 className="font-medium mb-1">Invite a teammate</h2>
          <p className="text-sm text-ink-2 mb-4">Admins manage everything except billing and deleting the studio. Members work with clients, sessions and galleries. Each seat is $18 a month.</p>
          <InviteForm />
        </Card>
      ) : (
        <UpgradeLock title="Invite your team">The Free plan includes 1 seat. Pro adds your whole team at $18 per seat, per month.</UpgradeLock>
      )}
      <Card>
        <h2 className="font-medium mb-4">Team</h2>
        <TeamManager members={members} invites={invites} currentUserId={ctx.user.id} currentUserRole={ctx.role} />
      </Card>
    </div>
  );
}
