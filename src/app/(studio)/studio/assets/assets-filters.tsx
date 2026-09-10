"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ASSET_FOLDERS } from "@/lib/assets-shared";

/** Folder and sort selects that write to the URL (plan 15.1.4, 15.1.5). */
export function AssetsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex items-center gap-2">
      <select value={search.get("folder") ?? ""} onChange={(e) => setParam("folder", e.target.value)} aria-label="Filter by folder" className="h-10 rounded-lg border border-line-2 bg-surface px-2 text-sm capitalize">
        <option value="">All folders</option>
        {ASSET_FOLDERS.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <select value={search.get("sort") ?? "recent"} onChange={(e) => setParam("sort", e.target.value)} aria-label="Sort" className="h-10 rounded-lg border border-line-2 bg-surface px-2 text-sm">
        <option value="recent">Newest</option>
        <option value="name">Name</option>
        <option value="largest">Largest</option>
      </select>
    </div>
  );
}
