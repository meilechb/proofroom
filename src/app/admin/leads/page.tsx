import type { Metadata } from "next";
import { requirePlatformAdminPage } from "@/lib/auth";
import { listLeads } from "@/lib/admin";
import { EmptyState } from "@/components/ui";
import { LeadsTable } from "./leads-table";

export const metadata: Metadata = { title: "Leads · Admin" };

export default async function AdminLeadsPage() {
  await requirePlatformAdminPage();
  const leads = await listLeads();
  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Leads</h1>
      {leads.length === 0 ? <EmptyState title="No leads" description="Contact-form and waitlist submissions appear here." /> : <LeadsTable leads={leads} />}
    </div>
  );
}
