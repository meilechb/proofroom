import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser, getStudioContext, listMemberships } from "@/lib/auth";
import { APP_NAME, supportEmail } from "@/lib/env";
import { switchStudioAction } from "@/app/(auth)/actions";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Studio suspended", robots: { index: false, follow: false } };

/**
 * Shown when requireStudioPage finds the active studio suspended. Lives outside
 * the studio layout on purpose: that layout runs the same check and would
 * redirect here again.
 */
export default async function SuspendedPage() {
  const user = await getCurrentUser();
  const ctx = user ? await getStudioContext() : null;
  const others = user ? (await listMemberships(user.id)).filter((m) => m.studio_id !== ctx?.studio.id && !m.studio.suspended_at) : [];
  const support = supportEmail();
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <Card className="max-w-lg w-full">
        <h1 className="text-xl font-semibold">{ctx ? `${ctx.studio.name} is suspended` : "This studio is suspended"}</h1>
        <p className="mt-3 text-sm text-ink-2">
          Access to this studio has been paused by {APP_NAME}. Its public galleries and website are offline while it is suspended. Nothing has been deleted.
        </p>
        <p className="mt-3 text-sm text-ink-2">
          If you think this is a mistake, write to <a href={`mailto:${support}`} className="underline">{support}</a> from the email on the account and we will look into it.
        </p>
        {others.length > 0 ? (
          <div className="mt-6">
            <p className="text-sm font-medium">Your other studios</p>
            <ul className="mt-2 space-y-1 text-sm">
              {others.map((m) => (
                <li key={m.studio_id}>
                  <form action={switchStudioAction} className="inline">
                    <input type="hidden" name="studioId" value={m.studio_id} />
                    <button className="underline">{m.studio.name}</button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-6 flex gap-4 text-sm">
          <Link href="/studio/account" className="underline">Account</Link>
          <form action="/logout" method="post"><button className="underline">Sign out</button></form>
        </div>
      </Card>
    </main>
  );
}
