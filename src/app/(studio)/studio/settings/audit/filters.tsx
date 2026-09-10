"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function AuditFilters({ actors, actions }: { actors: { id: string; name: string | null }[]; actions: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value); else params.delete(key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={search.get("actor") ?? ""} onChange={(e) => setParam("actor", e.target.value)} aria-label="Filter by person" className="h-10 rounded-lg border border-line-2 bg-surface px-2 text-sm">
        <option value="">Anyone</option>
        {actors.map((a) => <option key={a.id} value={a.id}>{a.name || "Unknown"}</option>)}
      </select>
      <select value={search.get("action") ?? ""} onChange={(e) => setParam("action", e.target.value)} aria-label="Filter by action" className="h-10 rounded-lg border border-line-2 bg-surface px-2 text-sm max-w-52">
        <option value="">All actions</option>
        {actions.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <input type="date" value={search.get("since") ?? ""} onChange={(e) => setParam("since", e.target.value)} aria-label="Since date" className="h-10 rounded-lg border border-line-2 bg-surface px-2 text-sm" />
    </div>
  );
}
