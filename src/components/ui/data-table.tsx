import Link from "next/link";
import type { ReactNode } from "react";
import { cx, EmptyState, Table, Td, Th } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

/** Table wrapper with sortable headers (via ?sort=), row links and an empty state (plan 4.21). */
export type Column<T> = { key: string; header: ReactNode; sortable?: boolean; className?: string; cell: (row: T) => ReactNode };

export function DataTable<T extends { id: string }>({ rows, columns, pathname, search, rowHref, empty, actions }: {
  rows: T[];
  columns: Column<T>[];
  pathname?: string;
  search?: Record<string, string | undefined>;
  rowHref?: (row: T) => string;
  empty: { title: string; description?: string; action?: ReactNode };
  actions?: (row: T) => ReactNode;
}) {
  if (rows.length === 0) return <EmptyState {...empty} />;
  const sort = search?.sort ?? "";
  const [sortKey, sortDir] = sort.startsWith("-") ? [sort.slice(1), "desc"] : [sort, "asc"];
  const headerHref = (key: string) => {
    if (!pathname) return null;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(search ?? {})) if (v && k !== "cursor" && k !== "sort") params.set(k, v);
    params.set("sort", sortKey === key && sortDir === "asc" ? `-${key}` : key);
    return `${pathname}?${params}`;
  };
  return (
    <Table>
      <thead>
        <tr>
          {columns.map((c) => {
            const href = c.sortable ? headerHref(c.key) : null;
            return (
              <Th key={c.key} className={c.className}>
                {href ? (
                  <Link href={href} className={cx("inline-flex items-center gap-1 hover:text-ink", sortKey === c.key && "text-ink")} aria-sort={sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined}>
                    {c.header}
                    {sortKey === c.key ? <Icon.ChevronDown size={12} className={sortDir === "asc" ? "rotate-180" : ""} /> : null}
                  </Link>
                ) : c.header}
              </Th>
            );
          })}
          {actions ? <Th className="w-12"><span className="sr-only">Actions</span></Th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-surface-2/60">
            {columns.map((c, i) => (
              <Td key={c.key} className={c.className}>
                {i === 0 && rowHref ? <Link href={rowHref(row)} className="font-medium hover:underline">{c.cell(row)}</Link> : c.cell(row)}
              </Td>
            ))}
            {actions ? <Td className="text-right">{actions(row)}</Td> : null}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
