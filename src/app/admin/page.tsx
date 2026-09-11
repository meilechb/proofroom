import type { Metadata } from "next";
import Link from "next/link";
import { listStudios, studioState, type StudioState } from "@/lib/admin";
import { formatBytes } from "@/lib/assets-shared";
import { Table, Th, Td, Badge, EmptyState, PageHeader } from "@/components/ui";
import { SearchInput } from "@/components/ui/search-input";
import { AdminStateFilter } from "./state-filter";

export const metadata: Metadata = { title: "Studios · Admin" };

const STATE_TONE: Record<StudioState, "neutral" | "success" | "warning" | "danger" | "brand"> = {
  trial: "brand", active: "success", past_due: "warning", comped: "brand", suspended: "danger", read_only: "warning", deleted: "danger",
};

export default async function AdminStudiosPage({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const state = typeof sp.state === "string" ? sp.state : undefined;
  const studios = await listStudios({ q, state });

  return (
    <div>
      <PageHeader
        title={`Studios (${studios.length})`}
        description="Every studio on the platform."
        actions={
          <>
            <SearchInput placeholder="Search name, slug or owner" className="w-full sm:w-64" />
            <AdminStateFilter />
          </>
        }
      />
      {studios.length === 0 ? (
        <EmptyState title="No studios" description="No studios match this filter." />
      ) : (
        <Table>
          <thead><tr><Th>Studio</Th><Th>Owner</Th><Th>State</Th><Th>Members</Th><Th>Storage</Th><Th>Stripe</Th><Th>Email domain</Th><Th>Created</Th></tr></thead>
          <tbody>
            {studios.map((s) => {
              const st = studioState(s);
              return (
                <tr key={s.id}>
                  <Td><Link href={`/admin/studios/${s.id}`} className="font-medium hover:text-brand">{s.name}</Link><div className="text-xs text-muted">{s.slug}</div></Td>
                  <Td><span className="text-xs">{s.owner_email ?? "—"}</span></Td>
                  <Td><Badge tone={STATE_TONE[st]}>{st.replace("_", " ")}</Badge></Td>
                  <Td>{s.members}</Td>
                  <Td><span className="text-xs">{formatBytes(s.storage_bytes)}</span></Td>
                  <Td>{s.stripe_charges_enabled ? <Badge tone="success">On</Badge> : s.stripe_account_id ? <Badge tone="warning">Setup</Badge> : <span className="text-xs text-muted">—</span>}</Td>
                  <Td>{s.sending_domain ? <span className="text-xs">{s.sending_status === "verified" ? "✓ " : ""}{s.sending_domain}</span> : <span className="text-xs text-muted">shared</span>}</Td>
                  <Td><span className="text-xs text-muted">{new Date(s.created_at).toLocaleDateString()}</span></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
