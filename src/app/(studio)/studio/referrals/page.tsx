import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { ensureReferralCode, referralStats } from "@/lib/referrals-server";
import { REFERRAL_REWARD_TEXT } from "@/lib/referrals";
import { appUrl } from "@/lib/env";
import { PageHeader, Card, Stat, Input, Badge, Table, Th, Td, EmptyState } from "@/components/ui";
import { CopyButton } from "@/components/forms/copy-button";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Referrals" };

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "brand"> = { invited: "neutral", signed_up: "brand", rewarded: "success", void: "warning" };

/** Refer other photographers; both sides get 10% off for 12 months (plan 20.1, 20.2). */
export default async function ReferralsPage() {
  const ctx = await requireStudioPage("admin");
  const code = await ensureReferralCode(ctx.studio.id);
  const link = `${appUrl()}/signup?ref=${code}`;
  const { counts, list } = await referralStats(ctx.studio.id);

  const emailText = `I use ${ctx.studio.name}'s tools for client galleries, booking and payments and thought you'd like them. If you sign up with my link and subscribe, we both get ${REFERRAL_REWARD_TEXT}:\n${link}`;
  const smsText = `Thought you'd like this for your photography business — sign up with my link and we both get ${REFERRAL_REWARD_TEXT}: ${link}`;

  return (
    <div>
      <PageHeader title="Referrals" description={`Refer another photographer. When they subscribe, you both get ${REFERRAL_REWARD_TEXT}.`} />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Stat label="Invited" value={counts.invited} />
        <Stat label="Signed up" value={counts.signed_up} />
        <Stat label="Rewarded" value={counts.rewarded} />
      </div>

      <Card className="mb-6">
        <h2 className="font-medium mb-2">Your link</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Input readOnly defaultValue={link} className="font-mono text-xs sm:w-96" />
          <CopyButton value={link} label="Copy link" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-line p-3">
            <div className="flex items-center justify-between"><p className="text-sm font-medium">Prewritten email</p><CopyButton value={emailText} /></div>
            <p className="mt-2 text-xs text-ink-2 whitespace-pre-line">{emailText}</p>
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="flex items-center justify-between"><p className="text-sm font-medium">Text message</p><CopyButton value={smsText} /></div>
            <p className="mt-2 text-xs text-ink-2 whitespace-pre-line">{smsText}</p>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="font-medium mb-1">Invite by email</h2>
        <p className="text-sm text-ink-2 mb-3">We send them your link from your studio. No spam — one message.</p>
        <InviteForm />
      </Card>

      <h2 className="font-medium mb-3">Your referrals</h2>
      {list.length === 0 ? (
        <EmptyState title="No referrals yet" description="Share your link above to get started." />
      ) : (
        <Table>
          <thead><tr><Th>Who</Th><Th>Status</Th><Th>When</Th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <Td>{r.referred_name ?? r.referred_email ?? "Pending"}</Td>
                <Td><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</Badge></Td>
                <Td><span className="text-xs text-muted">{new Date(r.created_at).toLocaleDateString()}</span></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
