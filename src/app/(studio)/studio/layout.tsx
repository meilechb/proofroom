import Link from "next/link";
import { requireStudioPage, listMemberships } from "@/lib/auth";
import { APP_NAME } from "@/lib/env";
import { Logo } from "@/components/ui";
import { StudioNav } from "@/components/studio/nav";
import { StudioSwitcher } from "@/components/studio/switcher";
import { Banners } from "@/components/studio/banners";
import { ToastProvider } from "@/components/ui/toast";
import { stopImpersonationAction } from "@/app/admin/studios/actions";

export const metadata = { robots: { index: false, follow: false } };

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStudioPage();
  const memberships = await listMemberships(ctx.user.id);
  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
      <aside className="lg:w-60 shrink-0 border-b lg:border-b-0 lg:border-r border-line bg-surface">
        <div className="p-4 flex items-center justify-between lg:block">
          <Link href="/studio" className="flex items-center gap-2 font-semibold">
            <Logo name={ctx.studio.name} logoUrl={ctx.studio.logo_url} />
            <span className="truncate">{ctx.studio.name}</span>
          </Link>
          {memberships.length > 1 ? <StudioSwitcher memberships={memberships.map((m) => ({ id: m.studio_id, name: m.studio.name }))} activeId={ctx.studio.id} /> : null}
        </div>
        <StudioNav role={ctx.role} />
        <div className="p-4 mt-auto hidden lg:block text-xs text-muted">
          <p className="truncate">{ctx.user.email}</p>
          <div className="mt-2 flex gap-3">
            <Link href="/studio/account" className="hover:text-ink">Account</Link>
            <form action="/logout" method="post"><button className="hover:text-ink">Sign out</button></form>
          </div>
          <p className="mt-3">{APP_NAME}</p>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        {ctx.impersonating ? (
          <div className="flex items-center justify-between gap-3 bg-danger px-4 py-2 text-sm text-white">
            <span>Viewing <strong>{ctx.studio.name}</strong> as an admin (read-only). Changes are blocked.</span>
            <form action={stopImpersonationAction}><button className="underline">Stop</button></form>
          </div>
        ) : null}
        <Banners user={ctx.user} studio={ctx.studio} billing={ctx.billing} />
        <ToastProvider>
          <main className="container-x py-6 lg:py-8">{children}</main>
        </ToastProvider>
      </div>
    </div>
  );
}
