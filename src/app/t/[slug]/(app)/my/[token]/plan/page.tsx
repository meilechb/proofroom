import Link from "next/link";
import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { verifyLink } from "@/lib/tenant-tokens";
import { db, one, rows } from "@/lib/db";

export const metadata = { robots: { index: false, follow: false } };

/** Read-only session plan a studio has shared with the client (plan 21.18). */
export default async function ClientPlanPage({ params }: PageProps<"/t/[slug]/my/[token]/plan">) {
  const { slug, token } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const clientId = verifyLink("hub", token);
  if (!clientId) notFound();

  // The most recent shared plan for one of this client's sessions.
  const plan = one<{ order_id: string; notes_md: string; shot_list: { id: string; text: string; done: boolean }[]; mood_asset_ids: string[]; title: string; scheduled_at: string | null }>(
    await db()`
      select sp.order_id, sp.notes_md, sp.shot_list, sp.mood_asset_ids, o.title, o.scheduled_at
      from session_plans sp join orders o on o.id = sp.order_id
      where sp.studio_id = ${studio.id} and o.client_id = ${clientId} and sp.client_visible = true
      order by coalesce(o.scheduled_at, o.created_at) desc limit 1`
  );
  if (!plan) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-16 text-center">
        <p className="text-[var(--site-ink-2)]">There is no shared plan to view right now.</p>
        <Link href={`/my/${token}`} className="mt-4 inline-block underline">Back to your portal</Link>
      </div>
    );
  }
  const mood = plan.mood_asset_ids.length
    ? rows<{ id: string; url: string; web_url: string | null; alt: string }>(await db()`select id, url, web_url, alt from assets where studio_id = ${studio.id} and id = any(${plan.mood_asset_ids}::uuid[])`)
    : [];
  const byId = new Map(mood.map((m) => [m.id, m]));
  const orderedMood = plan.mood_asset_ids.map((id) => byId.get(id)).filter(Boolean) as { id: string; url: string; web_url: string | null; alt: string }[];

  return (
    <div className="mx-auto w-full max-w-2xl px-5 sm:px-8 py-10">
      <Link href={`/my/${token}`} className="text-sm text-[var(--site-ink-2)] underline">← Your portal</Link>
      <h1 className="mt-3 text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>Plan for {plan.title}</h1>
      {plan.scheduled_at ? <p className="mt-1 text-[var(--site-ink-2)]">{new Date(plan.scheduled_at).toLocaleDateString("en-US", { timeZone: studio.timezone || "UTC", weekday: "long", month: "long", day: "numeric" })}</p> : null}

      {plan.notes_md ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--site-ink-2)]">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{plan.notes_md}</p>
        </section>
      ) : null}

      {plan.shot_list.length ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--site-ink-2)]">What we&apos;ll shoot</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {plan.shot_list.map((s) => <li key={s.id} className="flex items-center gap-2"><span className="text-[var(--site-ink-2)]">•</span>{s.text}</li>)}
          </ul>
        </section>
      ) : null}

      {orderedMood.length ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--site-ink-2)]">Looks and references</h2>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {orderedMood.map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={m.web_url ?? m.url} alt={m.alt} className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
            ))}
          </div>
        </section>
      ) : null}

      <p className="mt-10 text-xs text-[var(--site-ink-2)]">Have something to add? Email <a href={`mailto:${studio.email}`} className="underline">{studio.email}</a>.</p>
    </div>
  );
}
