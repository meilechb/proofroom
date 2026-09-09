"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

/** Search box that debounces into the ?q= parameter (plan 4.20). */
export function SearchInput({ param = "q", placeholder = "Search", className }: { param?: string; placeholder?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [value, setValue] = useState(search.get(param) ?? "");
  useEffect(() => {
    const current = search.get(param) ?? "";
    if (value === current) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(search.toString());
      if (value.trim()) params.set(param, value.trim());
      else params.delete(param);
      params.delete("cursor");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [value, param, pathname, router, search]);
  return (
    <div className={`relative ${className ?? ""}`}>
      <Icon.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <Input type="search" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="pl-9" aria-label={placeholder} />
    </div>
  );
}
