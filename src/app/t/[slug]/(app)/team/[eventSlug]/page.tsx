import { notFound } from "next/navigation";
import { studioBySlug, galleryBySlug } from "@/lib/tenant-data";
import { eventSummary } from "@/lib/galleries";
import { hasGalleryAccess } from "@/lib/gallery-access";
import { db, one } from "@/lib/db";
import { formatDate } from "@/lib/types";
import { ManagerUnlock } from "./unlock-form";

export const metadata = { robots: { index: false, follow: false } };

export default async function TeamManagerPage({ params }: PageProps<"/t/[slug]/team/[eventSlug]">) {
  const { slug, eventSlug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const parent = await galleryBySlug(studio.id, eventSlug);
  if (!parent) notFound();
  const childCount = one<{ n: number }>(await db()`select count(*)::int as n from galleries where parent_id = ${parent.id}`);
  if ((childCount?.n ?? 0) === 0) notFound(); // not a team event

  const unlocked = await hasGalleryAccess(parent.id);
  if (!unlocked) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-24 text-center">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>{parent.title}</h1>
        <p className="mt-3 text-[var(--site-ink-2)]">Enter the manager code to see how everyone is doing.</p>
        <div className="mt-6"><ManagerUnlock slug={slug} eventSlug={eventSlug} /></div>
      </div>
    );
  }

  const people = await eventSummary(studio.id, parent.id);
  const picked = people.filter((p) => p.favorites > 0).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 sm:px-8 py-10">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>{parent.title}</h1>
      <p className="mt-1 text-[var(--site-ink-2)]">{picked} of {people.length} have chosen. Share each person their own link to pick.</p>
      {people.length > 0 ? (
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--site-bg-2)]" aria-hidden>
          <div className="h-full rounded-full bg-[var(--site-primary)]" style={{ width: `${Math.round((picked / people.length) * 100)}%` }} />
        </div>
      ) : null}
      <div className="mt-6 rounded-xl border border-[var(--site-line)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[var(--site-ink-2)] border-b border-[var(--site-line)]">
            <th className="px-4 py-3">Person</th><th className="px-4 py-3">Opened</th><th className="px-4 py-3 text-right">Photos</th><th className="px-4 py-3 text-right">Picked</th>
          </tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-b border-[var(--site-line)] last:border-0">
                <td className="px-4 py-3 font-medium">{p.subject_name ?? p.title}</td>
                <td className="px-4 py-3 text-[var(--site-ink-2)]">{p.last_view ? formatDate(p.last_view) : "Not yet"}</td>
                <td className="px-4 py-3 text-right">{p.photos}</td>
                <td className="px-4 py-3 text-right">{p.favorites > 0 ? <span className="text-[var(--site-accent)] font-medium">{p.favorites}</span> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
