import type { Metadata } from "next";
import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { summary, topTargets } from "@/lib/analytics";
import { Card, PageHeader, Stat, EmptyState, Table, Th, Td } from "@/components/ui";

export const metadata: Metadata = { title: "Website analytics" };

const DAYS = 30;

/** Simple, private site analytics: views per page per day, top areas, contact submissions (plan 14.27). */
export default async function WebsiteAnalyticsPage() {
  const ctx = await requireStudioPage("admin");
  const studioId = ctx.studio.id;

  const [byDay, pages, contactRows] = await Promise.all([
    summary(studioId, "site_view", null, DAYS),
    topTargets(studioId, "site_view", DAYS, 50),
    db()`
      select to_char(created_at, 'YYYY-MM-DD') as day, count(*)::int as count
      from inquiries where studio_id = ${studioId} and source = 'website' and created_at >= now() - ${`${DAYS} days`}::interval
      group by 1 order by 1`,
  ]);
  const contact = contactRows as Array<{ day: string; count: number }>;

  const totalViews = byDay.reduce((sum, d) => sum + d.count, 0);
  const totalContacts = contact.reduce((sum, d) => sum + d.count, 0);
  const areas = pages.filter((p) => p.target.startsWith("/headshots/"));
  const regular = pages.filter((p) => !p.target.startsWith("/headshots/"));
  const days = lastDays(DAYS);
  const viewByDay = new Map(byDay.map((d) => [d.day, d.count]));
  const peak = Math.max(1, ...days.map((d) => viewByDay.get(d) ?? 0));
  const busiest = regular[0];

  return (
    <div>
      <PageHeader
        title="Website analytics"
        description={`Views on your public site over the last ${DAYS} days. Counts are private to you; no visitor is identified and no cookie is set.`}
        eyebrow="Website"
        actions={<Link href="/studio/website" className="btn-ghost btn-sm">Back to editor</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Page views" value={totalViews.toLocaleString()} hint={`Last ${DAYS} days`} />
        <Stat label="Contact form messages" value={totalContacts.toLocaleString()} hint={`Last ${DAYS} days`} />
        <Stat label="Busiest page" value={busiest ? pageLabel(busiest.target) : "—"} hint={busiest ? `${busiest.count.toLocaleString()} views` : "No views yet"} />
      </div>

      <Card className="mt-6">
        <h2 className="font-medium">Views per day</h2>
        {totalViews === 0 ? (
          <p className="mt-2 text-sm text-ink-2">No views recorded yet. Publish your site and share the link to start seeing traffic here.</p>
        ) : (
          <div className="mt-4 flex items-end gap-[3px] h-32" role="img" aria-label={`${totalViews} views over ${DAYS} days`}>
            {days.map((d) => {
              const count = viewByDay.get(d) ?? 0;
              return (
                <div key={d} className="flex-1 flex flex-col justify-end" title={`${formatDay(d)}: ${count} view${count === 1 ? "" : "s"}`}>
                  <div className="rounded-t bg-brand/80" style={{ height: `${Math.round((count / peak) * 100)}%`, minHeight: count > 0 ? 2 : 0 }} />
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-2 flex justify-between text-xs text-muted"><span>{formatDay(days[0])}</span><span>Today</span></div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="font-medium mb-3">Top pages</h2>
          {regular.length === 0 ? (
            <EmptyState title="No page views yet" description="Views appear here once visitors browse your site." />
          ) : (
            <Table>
              <thead><tr><Th>Page</Th><Th className="text-right">Views</Th></tr></thead>
              <tbody>
                {regular.map((p) => (
                  <tr key={p.target}><Td>{pageLabel(p.target)} <span className="text-muted font-mono text-xs">{p.target}</span></Td><Td className="text-right tabular-nums">{p.count.toLocaleString()}</Td></tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
        <div>
          <h2 className="font-medium mb-3">Top areas</h2>
          {areas.length === 0 ? (
            <EmptyState title="No area pages yet" description="Turn on local-area pages in the editor to reach nearby searches. Their views show here." />
          ) : (
            <Table>
              <thead><tr><Th>Area</Th><Th className="text-right">Views</Th></tr></thead>
              <tbody>
                {areas.map((p) => (
                  <tr key={p.target}><Td>{areaLabel(p.target)}</Td><Td className="text-right tabular-nums">{p.count.toLocaleString()}</Td></tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

function lastDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function pageLabel(target: string) {
  if (target === "/") return "Home";
  const known: Record<string, string> = { "/portfolio": "Portfolio", "/pricing": "Pricing", "/about": "About", "/contact": "Contact", "/book": "Book" };
  if (known[target]) return known[target];
  const seg = target.replace(/^\//, "").split("/")[0];
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

function areaLabel(target: string) {
  const town = target.replace(/^\/headshots\//, "").replace(/-/g, " ");
  return town.replace(/\b\w/g, (c) => c.toUpperCase());
}
