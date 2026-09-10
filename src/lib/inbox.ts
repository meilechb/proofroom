import "server-only";

import { db, one, rows } from "@/lib/db";
import type { Inquiry } from "@/lib/types";
import { resolveTemplate, type TemplateValues } from "@/lib/email-templates";

/** Inbox: inquiries plus the booking-request detail some carry (plan 10.1). */
export type InquiryRow = Inquiry & { has_booking: boolean; package_name: string | null; people_count: number | null };

export async function listInquiries(studioId: string, filter: "all" | "unread" | "archived", limit = 51, cursor?: string | null) {
  const status = filter === "unread" ? "new" : filter === "archived" ? "archived" : null;
  return rows<InquiryRow>(
    await db()`
      select i.*, (br.id is not null) as has_booking, p.name as package_name, br.people_count
      from inquiries i
      left join booking_requests br on br.inquiry_id = i.id
      left join packages p on p.id = br.package_id
      where i.studio_id = ${studioId}
        and case when ${status}::text is null then i.status <> 'archived' else i.status = ${status} end
        and (${cursor ?? null}::timestamptz is null or i.created_at < ${cursor ?? null}::timestamptz)
      order by (i.status = 'new') desc, i.created_at desc
      limit ${limit}`
  );
}

export async function inboxCounts(studioId: string) {
  return one<{ unread: number; all: number; archived: number }>(
    await db()`
      select
        count(*) filter (where status = 'new')::int as unread,
        count(*) filter (where status <> 'archived')::int as all,
        count(*) filter (where status = 'archived')::int as archived
      from inquiries where studio_id = ${studioId}`
  );
}

export async function getInquiry(studioId: string, id: string) {
  return one<InquiryRow>(
    await db()`
      select i.*, (br.id is not null) as has_booking, p.name as package_name, br.people_count, br.preferred_dates, br.location_pref
      from inquiries i left join booking_requests br on br.inquiry_id = i.id left join packages p on p.id = br.package_id
      where i.id = ${id} and i.studio_id = ${studioId} limit 1`
  );
}

export async function markInquiry(studioId: string, ids: string[], status: "new" | "read" | "archived") {
  if (ids.length === 0) return;
  await db()`update inquiries set status = ${status} where studio_id = ${studioId} and id = any(${ids}::uuid[])`;
}

/** The studio's saved copy for a template key, falling back to the built-in default. */
export async function studioTemplate(studioId: string, key: Parameters<typeof resolveTemplate>[0]): Promise<TemplateValues> {
  const row = one<{ subject: string; body: string; cta_label: string | null }>(
    await db()`select subject, body, cta_label from email_templates where studio_id = ${studioId} and key = ${key} limit 1`
  );
  return resolveTemplate(key, row ? { subject: row.subject, body: row.body, cta_label: row.cta_label ?? undefined } : null);
}
