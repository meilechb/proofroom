import Link from "next/link";
import { Icon } from "@/components/ui/icons";

/**
 * Cursor pagination helpers (plan 4.19). Lists are ordered by created_at desc;
 * the cursor is the created_at of the last row shown. Fetch limit + 1 rows to
 * know whether a next page exists.
 */
export const PAGE_SIZE = 50;

export function paginate<T extends { created_at: string }>(rows: T[], limit = PAGE_SIZE) {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { page, nextCursor: hasMore ? page[page.length - 1]?.created_at ?? null : null };
}

export function Pagination({ pathname, search, nextCursor }: { pathname: string; search: Record<string, string | undefined>; nextCursor: string | null }) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) if (v && k !== "cursor") params.set(k, v);
  const first = params.toString() ? `${pathname}?${params}` : pathname;
  if (nextCursor) params.set("cursor", nextCursor);
  const next = `${pathname}?${params}`;
  if (!nextCursor && !search.cursor) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
      {search.cursor ? <Link href={first} className="btn-secondary btn-sm"><Icon.ChevronLeft size={14} /> First page</Link> : <span />}
      {nextCursor ? <Link href={next} className="btn-secondary btn-sm">Next <Icon.ChevronRight size={14} /></Link> : <span />}
    </nav>
  );
}
