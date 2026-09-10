import { requireStudioPage } from "@/lib/auth";
import { inboxCounts, listInquiries, studioTemplate } from "@/lib/inbox";
import { resolveTemplate } from "@/lib/email-templates";
import { formatDate } from "@/lib/types";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { Tabs } from "@/components/ui/tabs";
import { Pagination, paginate } from "@/components/ui/pagination";
import { InquiryPanel } from "./inquiry-panel";
import { markInquiriesAction } from "./actions";

export const metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: PageProps<"/studio/inbox">) {
  const ctx = await requireStudioPage();
  const sp = await searchParams;
  const tab = (typeof sp.tab === "string" ? sp.tab : "all") as "all" | "unread" | "archived";
  const filter = tab === "unread" || tab === "archived" ? tab : "all";
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;

  const [counts, rows, template] = await Promise.all([
    inboxCounts(ctx.studio.id),
    listInquiries(ctx.studio.id, filter, 31, cursor),
    studioTemplate(ctx.studio.id, "inquiry_reply").catch(() => resolveTemplate("inquiry_reply", null)),
  ]);
  const { page, nextCursor } = paginate(rows, 30);

  return (
    <>
      <PageHeader title="Inbox" description="Inquiries and booking requests from your website and booking page." />
      <Tabs
        items={[
          { value: "all", label: "All", count: counts?.all ?? 0 },
          { value: "unread", label: "Unread", count: counts?.unread ?? 0 },
          { value: "archived", label: "Archived", count: counts?.archived ?? 0 },
        ]}
      />
      <div className="mt-4">
        {page.length === 0 ? (
          <EmptyState title={filter === "unread" ? "Nothing unread" : filter === "archived" ? "Nothing archived" : "No inquiries yet"} description="New inquiries from your website contact form and booking page will show up here." />
        ) : (
          <ul className="space-y-2">
            {page.map((inq) => (
              <li key={inq.id} className={`card card-pad flex items-start justify-between gap-4 ${inq.status === "new" ? "border-l-2 border-l-accent" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <InquiryPanel inquiry={inq} template={{ subject: template.subject, body: template.body }} />
                    {inq.status === "new" ? <Badge tone="brand">New</Badge> : null}
                    {inq.has_booking ? <Badge>Booking</Badge> : null}
                  </div>
                  <p className="text-xs text-muted">{inq.email} · {formatDate(inq.created_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  {inq.message ? <p className="mt-1 text-sm text-ink-2 line-clamp-2">{inq.message}</p> : null}
                </div>
                <form action={markInquiriesAction} className="shrink-0">
                  <input type="hidden" name="id" value={inq.id} />
                  <input type="hidden" name="status" value={inq.status === "archived" ? "read" : "archived"} />
                  <button className="text-xs text-muted hover:text-ink">{inq.status === "archived" ? "Restore" : "Archive"}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <Pagination pathname="/studio/inbox" search={{ tab: tab === "all" ? undefined : tab, cursor }} nextCursor={nextCursor} />
      </div>
    </>
  );
}
