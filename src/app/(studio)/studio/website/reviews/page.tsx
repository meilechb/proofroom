import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { db, rows } from "@/lib/db";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { AddReviewForm } from "./review-form";
import { deleteReviewAction, moveReviewAction, toggleReviewAction } from "./actions";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  const ctx = await requireStudioPage("admin");
  const reviews = rows<{ id: string; name: string; body: string; rating: number | null; source: string | null; is_published: boolean }>(
    await db()`select id, name, body, rating, source, is_published from reviews where studio_id = ${ctx.studio.id} order by sort_order, created_at`
  );
  return (
    <>
      <PageHeader title="Reviews" description="Client reviews shown in the testimonials section of your website." actions={<Link href="/studio/website" className="btn-secondary">Back to website</Link>} />
      <div className="mb-6"><AddReviewForm /></div>
      {reviews.length === 0 ? (
        <EmptyState title="No reviews yet" description="Add a few and they will appear on your site." />
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="card card-pad flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium">{r.name} {r.rating ? <span className="text-warning">{"★".repeat(r.rating)}</span> : null} {!r.is_published ? <Badge>Hidden</Badge> : null}</p>
                <p className="text-sm text-ink-2 mt-1">{r.body}</p>
                {r.source ? <p className="text-xs text-muted mt-1">{r.source}</p> : null}
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs">
                <form action={moveReviewAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="dir" value="up" /><button aria-label="Move up" className="text-muted hover:text-ink">↑</button></form>
                <form action={moveReviewAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="dir" value="down" /><button aria-label="Move down" className="text-muted hover:text-ink">↓</button></form>
                <form action={toggleReviewAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="publish" value={r.is_published ? "false" : "true"} /><button className="text-muted hover:text-ink">{r.is_published ? "Hide" : "Show"}</button></form>
                <form action={deleteReviewAction}><input type="hidden" name="id" value={r.id} /><button className="text-muted hover:text-danger">Delete</button></form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
