"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STATES = ["all", "trial", "active", "past_due", "comped", "read_only", "suspended", "deleted"];

export function AdminStateFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  return (
    <select
      value={search.get("state") ?? "all"}
      onChange={(e) => {
        const params = new URLSearchParams(search.toString());
        if (e.target.value === "all") params.delete("state"); else params.set("state", e.target.value);
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      }}
      aria-label="Filter by state"
      className="h-10 rounded-lg border border-line-2 bg-surface px-2 text-sm capitalize"
    >
      {STATES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
    </select>
  );
}
