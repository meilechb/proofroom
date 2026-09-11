import type { Metadata } from "next";
import { requirePlatformAdminPage } from "@/lib/auth";
import { listLeads } from "@/lib/admin";
import { EmptyState, PageHeader } from "@/components/ui";
import { LeadsTable } from "./leads-table";

export const metadata: Metadata = { title: "Leads · Admin" };

export default async function AdminLeadsPage() {
  await requirePlatformAdminPage();
  const leads = await listLeads();
  return (
    <div>
      <PageHeader title="Leads" description="Contact-form and waitlist submissions." />
      {leads.length === 0 ? <EmptyState title="No leads" description="Contact-form and waitlist submissions appear here." /> : <LeadsTable leads={leads} />}
    </div>
  );
}
