import type { Metadata } from "next";
import { requirePlatformAdminPage } from "@/lib/auth";
import { listReferrals } from "@/lib/admin";
import { EmptyState } from "@/components/ui";
import { ReferralsTable } from "./referrals-table";

export const metadata: Metadata = { title: "Referrals · Admin" };

export default async function AdminReferralsPage() {
  await requirePlatformAdminPage();
  const rows = await listReferrals();
  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Referrals</h1>
      {rows.length === 0 ? <EmptyState title="No referrals" description="Referrals from studios appear here." /> : <ReferralsTable rows={rows} />}
    </div>
  );
}
