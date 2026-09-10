import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { siteFromDraft } from "@/lib/site/render";
import { db, rows } from "@/lib/db";
import { studioBaseUrl } from "@/lib/tenant";
import { PageHeader, EmptyState, Badge, Notice } from "@/components/ui";
import { AddAreaForm } from "./area-form";
import { deleteAreaAction, toggleAreaAction } from "./actions";

export const metadata = { title: "Local areas" };

export default async function AreasPage() {
  const ctx = await requireStudioPage("admin");
  const site = siteFromDraft(ctx.studio);
  const areas = rows<{ id: string; town: string; slug: string; is_published: boolean }>(
    await db()`select id, town, slug, is_published from site_areas where studio_id = ${ctx.studio.id} order by sort_order, created_at`
  );
  const base = studioBaseUrl(ctx.studio);
  return (
    <>
      <PageHeader title="Local areas" description="One SEO page per town you serve, e.g. Headshots in Brooklyn." actions={<Link href="/studio/website" className="btn-secondary">Back to website</Link>} />
      {!site.areas.enabled ? <Notice tone="warning" className="mb-4">Local area pages are turned off. Enable them under Pages in the website editor to make these live.</Notice> : null}
      <div className="mb-6"><AddAreaForm /></div>
      {areas.length === 0 ? (
        <EmptyState title="No areas yet" description="Add the towns and cities you serve." />
      ) : (
        <ul className="space-y-2">
          {areas.map((a) => (
            <li key={a.id} className="card card-pad flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{a.town} {!a.is_published ? <Badge>Hidden</Badge> : null}</p>
                <a href={`${base}/headshots/${a.slug}`} target="_blank" rel="noopener" className="text-xs text-muted hover:text-ink">/headshots/{a.slug}</a>
              </div>
              <div className="flex items-center gap-3 text-xs shrink-0">
                <form action={toggleAreaAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="publish" value={a.is_published ? "false" : "true"} /><button className="text-muted hover:text-ink">{a.is_published ? "Hide" : "Show"}</button></form>
                <form action={deleteAreaAction}><input type="hidden" name="id" value={a.id} /><button className="text-muted hover:text-danger">Delete</button></form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
