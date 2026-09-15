import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { listTasks } from "@/lib/tasks";
import { db, one } from "@/lib/db";
import { formatDate } from "@/lib/types";
import { PageHeader, EmptyState, Badge, cx } from "@/components/ui";
import { Tabs } from "@/components/ui/tabs";
import { NewTaskForm } from "./new-task-form";
import { completeTaskAction, deleteTaskAction } from "./actions";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: PageProps<"/studio/tasks">) {
  const ctx = await requireStudioPage();
  const sp = await searchParams;
  const view = (["open", "today", "overdue", "done", "all"].includes(String(sp.tab)) ? sp.tab : "open") as "open" | "today" | "overdue" | "done" | "all";
  const [tasks, counts] = await Promise.all([
    listTasks(ctx.studio.id, view),
    one<{ open: number; today: number; overdue: number }>(
      await db()`select
        count(*) filter (where done_at is null)::int as open,
        count(*) filter (where done_at is null and due_on = current_date)::int as today,
        count(*) filter (where done_at is null and due_on < current_date)::int as overdue
      from tasks where studio_id = ${ctx.studio.id}`
    ),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title="Tasks" description="A shared to-do list for the studio. Attach tasks to clients from their record." />
      <div className="mb-4"><NewTaskForm /></div>
      <Tabs
        items={[
          { value: "open", label: "Open", count: counts?.open ?? 0 },
          { value: "today", label: "Due today", count: counts?.today ?? 0 },
          { value: "overdue", label: "Overdue", count: counts?.overdue ?? 0 },
          { value: "done", label: "Done" },
          { value: "all", label: "All" },
        ]}
      />
      <div className="mt-4">
        {tasks.length === 0 ? (
          <EmptyState title={view === "done" ? "Nothing finished yet" : "No tasks"} description="Add one above, or create tasks from a client's record." />
        ) : (
          <ul className="card divide-y divide-line">
            {tasks.map((t) => {
              const overdue = !t.done_at && t.due_on && t.due_on < today;
              return (
                <li key={t.id} className="flex items-start gap-3 px-4 py-3.5">
                  <form action={completeTaskAction} className="pt-0.5">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="done" value={t.done_at ? "false" : "true"} />
                    <button aria-label={t.done_at ? "Mark not done" : "Mark done"} className={cx("h-5 w-5 rounded-md border flex items-center justify-center text-[11px]", t.done_at ? "bg-success border-success text-white" : "border-line-2 hover:border-ink")}>
                      {t.done_at ? "✓" : ""}
                    </button>
                  </form>
                  <div className="min-w-0 flex-1">
                    <p className={cx("text-sm", t.done_at && "line-through text-muted")}>{t.title}</p>
                    {t.client_name ? <p className="mt-0.5 text-xs text-muted"><Link href={`/studio/clients/${t.client_id}`} className="hover:underline">{t.client_name}</Link></p> : null}
                  </div>
                  {t.due_on ? <Badge tone={overdue ? "danger" : "neutral"} className="mt-0.5 shrink-0">Due {formatDate(t.due_on, { month: "short", day: "numeric" })}</Badge> : null}
                  <form action={deleteTaskAction} className="pt-0.5">
                    <input type="hidden" name="id" value={t.id} />
                    <button className="text-xs text-muted hover:text-danger" aria-label="Delete task">Delete</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
