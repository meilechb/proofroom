import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { listTags, searchClients } from "@/lib/clients";
import { clientStages, clientStageLabels, type ClientStage } from "@/lib/types";
import { db, one } from "@/lib/db";
import { PageHeader, EmptyState, ButtonLink } from "@/components/ui";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs } from "@/components/ui/tabs";
import { Pagination, paginate } from "@/components/ui/pagination";
import { ClientRows } from "./clients-table";
import { NewClientButton } from "./new-client-dialog";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/studio/clients">) {
  const ctx = await requireStudioPage();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const tag = typeof sp.tag === "string" ? sp.tag : undefined;
  const tab = typeof sp.tab === "string" ? sp.tab : "all";
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;
  const archived = tab === "archived";
  const stage = clientStages.includes(tab as ClientStage) ? (tab as ClientStage) : "all";

  const counts = one<Record<string, number>>(
    await db()`
      select
        count(*) filter (where not archived)::int as all,
        count(*) filter (where stage = 'lead' and not archived)::int as lead,
        count(*) filter (where stage = 'booked' and not archived)::int as booked,
        count(*) filter (where stage = 'delivered' and not archived)::int as delivered,
        count(*) filter (where archived)::int as archived
      from clients where studio_id = ${ctx.studio.id}`
  );
  const rows = await searchClients(ctx.studio.id, { q, stage, tag, archived }, 51, cursor);
  const { page, nextCursor } = paginate(rows, 50);
  const tags = await listTags(ctx.studio.id);

  return (
    <>
      <PageHeader
        title="Clients"
        description="Everyone you photograph, with their stage and any balance due."
        actions={
          <>
            <ButtonLink href={`/api/clients/export${q || tag || tab !== "all" ? `?${new URLSearchParams({ ...(q ? { q } : {}), ...(tag ? { tag } : {}), ...(tab !== "all" ? { tab } : {}) })}` : ""}`} variant="secondary">Export CSV</ButtonLink>
            <ButtonLink href="/studio/clients/import" variant="secondary">Import</ButtonLink>
            <NewClientButton open={sp.new === "1"} />
          </>
        }
      />

      <Tabs
        items={[
          { value: "all", label: "All", count: counts?.all ?? 0 },
          { value: "lead", label: clientStageLabels.lead, count: counts?.lead ?? 0 },
          { value: "booked", label: clientStageLabels.booked, count: counts?.booked ?? 0 },
          { value: "delivered", label: clientStageLabels.delivered, count: counts?.delivered ?? 0 },
          { value: "archived", label: "Archived", count: counts?.archived ?? 0 },
        ]}
      />

      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <SearchInput placeholder="Search name, email or company" className="sm:max-w-xs" />
        {tags.length ? (
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-muted text-xs">Tags:</span>
            {tags.slice(0, 8).map((t) => (
              <Link key={t.tag} href={tag === t.tag ? "/studio/clients" : `/studio/clients?tag=${encodeURIComponent(t.tag)}`} className={tag === t.tag ? "badge-brand" : "badge-neutral hover:border-line-2"}>
                {t.tag} <span className="opacity-60">{t.count}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        {page.length === 0 ? (
          <EmptyState
            title={q || tag ? "No clients match" : archived ? "No archived clients" : "No clients yet"}
            description={q || tag ? "Try a different search or clear the filter." : "Add your first client, or import from a CSV or another tool."}
            action={!q && !tag && !archived ? <div className="flex gap-2"><NewClientButton /><ButtonLink href="/studio/clients/import" variant="secondary">Import</ButtonLink></div> : undefined}
          />
        ) : (
          <>
            <ClientRows clients={page} />
            <Pagination pathname="/studio/clients" search={{ q, tag, tab: tab === "all" ? undefined : tab, cursor }} nextCursor={nextCursor} />
          </>
        )}
      </div>
    </>
  );
}
