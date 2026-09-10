import { notFound } from "next/navigation";
import { requireStudioPage } from "@/lib/auth";
import { getOrder } from "@/lib/orders";
import { getPlan } from "@/lib/planning";
import { db, one, rows } from "@/lib/db";
import { formatDate, type Client } from "@/lib/types";
import { PrintButton } from "./print-button";

export const metadata = { robots: { index: false, follow: false } };

/** Print-friendly session plan for the studio (plan 21.20). Its own clean page, no app chrome. */
export default async function PlanPrintPage({ params }: PageProps<"/plan/[id]/print">) {
  const ctx = await requireStudioPage();
  const { id } = await params;
  const order = await getOrder(ctx.studio.id, id);
  if (!order) notFound();
  const [client, plan] = await Promise.all([
    one<Client>(await db()`select * from clients where id = ${order.client_id} and studio_id = ${ctx.studio.id}`),
    getPlan(ctx.studio.id, id),
  ]);
  const mood = plan && plan.mood_asset_ids.length
    ? rows<{ id: string; url: string; web_url: string | null; alt: string }>(await db()`select id, url, web_url, alt from assets where studio_id = ${ctx.studio.id} and id = any(${plan.mood_asset_ids}::uuid[])`)
    : [];
  const byId = new Map(mood.map((m) => [m.id, m]));
  const orderedMood = (plan?.mood_asset_ids ?? []).map((mid) => byId.get(mid)).filter(Boolean) as { id: string; url: string; web_url: string | null; alt: string }[];

  return (
    <main className="mx-auto max-w-3xl bg-white px-8 py-10 text-neutral-900">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{ctx.studio.name}</h1>
          <p className="text-sm text-neutral-500">Session plan</p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-6 border-y border-neutral-200 py-3 text-sm">
        <p><strong>Session:</strong> #{order.order_number} {order.title}</p>
        {client ? <p><strong>Client:</strong> {client.name} · {client.email}{client.phone ? ` · ${client.phone}` : ""}</p> : null}
        <p><strong>When:</strong> {order.scheduled_at ? formatDate(order.scheduled_at, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Not scheduled"}</p>
        {order.location ? <p><strong>Where:</strong> {order.location}</p> : null}
      </div>

      {plan?.notes_md ? (
        <section className="mb-6">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">Notes</h2>
          <p className="whitespace-pre-wrap text-sm">{plan.notes_md}</p>
        </section>
      ) : null}

      {plan && plan.shot_list.length ? (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Shot list</h2>
          <ul className="space-y-1 text-sm">
            {plan.shot_list.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 shrink-0 rounded-sm border border-neutral-400 text-center text-[10px] leading-4">{s.done ? "✓" : ""}</span>
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {orderedMood.length ? (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Mood board</h2>
          <div className="grid grid-cols-3 gap-2">
            {orderedMood.map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={m.web_url ?? m.url} alt={m.alt} className="aspect-square w-full rounded object-cover" />
            ))}
          </div>
        </section>
      ) : null}

      {!plan || (!plan.notes_md && plan.shot_list.length === 0 && orderedMood.length === 0) ? (
        <p className="text-sm text-neutral-500">This session has no plan yet.</p>
      ) : null}
    </main>
  );
}
