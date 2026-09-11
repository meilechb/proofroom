"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ASSET_FOLDERS } from "@/lib/assets-shared";
import { cx } from "@/components/ui";

/** Folder chips and a sort select that write to the URL (plan 15.1.4, 15.1.5). */
export function AssetsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const folder = search.get("folder") ?? "";

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(search.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by folder">
        {["", ...ASSET_FOLDERS].map((f) => {
          const active = folder === f;
          return (
            <button
              key={f || "all"}
              type="button"
              onClick={() => setParam("folder", f)}
              aria-pressed={active}
              className={cx(
                "rounded-full border px-3.5 py-1.5 text-[13px] font-semibold capitalize transition-colors",
                active ? "border-brand bg-brand text-brand-ink" : "border-line-2 bg-surface text-ink-2 hover:border-brand/40"
              )}
            >
              {f || "All"}
            </button>
          );
        })}
      </div>
      <select value={search.get("sort") ?? "recent"} onChange={(e) => setParam("sort", e.target.value)} aria-label="Sort" className="h-10 rounded-lg border border-line-2 bg-surface px-2 text-sm">
        <option value="recent">Newest</option>
        <option value="name">Name</option>
        <option value="largest">Largest</option>
      </select>
    </div>
  );
}
