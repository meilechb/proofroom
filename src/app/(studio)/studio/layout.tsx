import Link from "next/link";
import { requireStudioPage, listMemberships } from "@/lib/auth";
import { db, one } from "@/lib/db";
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
  const [memberships, waiting] = await Promise.all([
    listMemberships(ctx.user.id),
    one<{ inbox: number; notes: number }>(
      await db()`
        select (select count(*)::int from inquiries where studio_id = ${ctx.studio.id} and status = 'new') as inbox,
               (select count(*)::int from photo_comments where studio_id = ${ctx.studio.id} and author_role = 'client' and not resolved) as notes`
    ),
  ]);
  const badges = { "/studio/inbox": waiting?.inbox ?? 0, "/studio/galleries": waiting?.notes ?? 0 };
  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
      <aside className="lg:w-[236px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 bg-pine-dark text-white flex flex-col">
        <div className="p-4 flex items-center justify-between lg:block">
          <Link href="/studio" className="flex items-center gap-2 font-display text-[15px] text-white">
            <Logo name={ctx.studio.name} logoUrl={ctx.studio.logo_url} />
            <span className="truncate">{ctx.studio.name}</span>
          </Link>
          {memberships.length > 1 ? <StudioSwitcher memberships={memberships.map((m) => ({ id: m.studio_id, name: m.studio.name }))} activeId={ctx.studio.id} /> : null}
        </div>
        <StudioNav role={ctx.role} badges={badges} />
        <div className="p-4 mt-auto hidden lg:block text-xs text-white/50 border-t border-white/10">
          <p className="truncate text-white/70">{ctx.user.email}</p>
          <div className="mt-2 flex gap-3">
            <Link href="/studio/account" className="hover:text-white">Account</Link>
            <form action="/logout" method="post"><button className="hover:text-white">Sign out</button></form>
          </div>
          <p className="mt-3 font-display text-white/40">{APP_NAME}</p>
        </div>
      </aside>
      <div className="flex-1 min-w-0 bg-app">
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
