import type { Metadata } from "next";
import { requirePlatformAdminPage } from "@/lib/auth";
import { listReferrals } from "@/lib/admin";
import { EmptyState, PageHeader } from "@/components/ui";
import { ReferralsTable } from "./referrals-table";

export const metadata: Metadata = { title: "Referrals · Admin" };

export default async function AdminReferralsPage() {
  await requirePlatformAdminPage();
  const rows = await listReferrals();
  return (
    <div>
      <PageHeader title="Referrals" description="Referrals from studios and their reward status." />
      {rows.length === 0 ? <EmptyState title="No referrals" description="Referrals from studios appear here." /> : <ReferralsTable rows={rows} />}
    </div>
  );
}
