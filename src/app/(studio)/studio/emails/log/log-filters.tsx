"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function LogFilters({ templates }: { templates: string[] }) {
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
    <div className="flex items-center gap-2">
      <select value={search.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value)} aria-label="Filter by status" className="h-10 rounded-lg border border-line-2 bg-surface px-2 text-sm">
        <option value="">All statuses</option>
        <option value="sent">Sent</option>
        <option value="failed">Failed</option>
        <option value="skipped">Skipped</option>
      </select>
      <select value={search.get("template") ?? ""} onChange={(e) => setParam("template", e.target.value)} aria-label="Filter by template" className="h-10 rounded-lg border border-line-2 bg-surface px-2 text-sm max-w-40">
        <option value="">All templates</option>
        {templates.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );
}
