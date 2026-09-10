import type { Metadata } from "next";
import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { Card } from "@/components/ui";
import { DeleteStudioForm } from "./delete-form";

export const metadata: Metadata = { title: "Data" };

/** Export and studio deletion (plan 17.7). */
export default async function DataSettingsPage() {
  const ctx = await requireStudioPage("admin");
  const isOwner = ctx.role === "owner";

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-medium mb-1">Export your data</h2>
        <p className="text-sm text-ink-2 mb-4">Download a zip of your records — clients, sessions, payments, galleries and inquiries — as JSON, with a clients spreadsheet. Photos and documents stay in their galleries.</p>
        <a href="/api/data/export" className="btn-secondary btn-sm">Download export (.zip)</a>
      </Card>

      <Card>
        <h2 className="font-medium mb-1">Import</h2>
        <p className="text-sm text-ink-2">Moving from another tool? <Link href="/studio/import" className="underline">Import</Link> brings in your galleries and clients from Pixieset, Pic-Time, ShootProof, plain zips or a contacts CSV.</p>
      </Card>

      <Card>
        <h2 className="font-medium mb-1">Activity log</h2>
        <p className="text-sm text-ink-2 mb-3">A record of account changes — invites, role changes, deletions and security events.</p>
        <Link href="/studio/settings/audit" className="btn-secondary btn-sm">View activity log</Link>
      </Card>

      <Card className="border-danger/30">
        <h2 className="font-medium text-danger mb-1">Delete studio</h2>
        {isOwner ? (
          <DeleteStudioForm studioName={ctx.studio.name} />
        ) : (
          <p className="text-sm text-ink-2">Only the studio owner can delete the studio.</p>
        )}
      </Card>
    </div>
  );
}
