import Link from "next/link";
import { requirePlatformAdminPage } from "@/lib/auth";
import { AdminNav } from "./nav";

/** Platform admin shell, separate from the studio app (plan 19.1). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdminPage();
  return (
    <div className="min-h-screen bg-surface-2">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded bg-danger px-2 py-0.5 text-xs font-semibold text-white">Platform admin</span>
            <span className="text-sm text-muted">Internal</span>
          </div>
          <Link href="/studio" className="text-sm text-ink-2 hover:text-ink">← Back to studio</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6 grid lg:grid-cols-[200px_1fr] gap-6">
        <AdminNav />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
