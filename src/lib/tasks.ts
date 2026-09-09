import "server-only";

import { db, one, rows } from "@/lib/db";

export type Task = { id: string; studio_id: string; client_id: string | null; order_id: string | null; title: string; due_on: string | null; done_at: string | null; created_by: string | null; created_at: string; client_name?: string | null };

export async function createTask(studioId: string, input: { title: string; clientId?: string | null; orderId?: string | null; dueOn?: string | null; createdBy?: string | null }) {
  return one<Task>(
    await db()`insert into tasks (studio_id, client_id, order_id, title, due_on, created_by) values (${studioId}, ${input.clientId ?? null}, ${input.orderId ?? null}, ${input.title.trim()}, ${input.dueOn ?? null}, ${input.createdBy ?? null}) returning *`
  );
}

export async function completeTask(studioId: string, id: string, done = true) {
  return one<Task>(await db()`update tasks set done_at = ${done ? new Date().toISOString() : null} where id = ${id} and studio_id = ${studioId} returning *`);
}

export async function updateTask(studioId: string, id: string, patch: { title?: string; dueOn?: string | null; clientId?: string | null }) {
  const current = one<Task>(await db()`select * from tasks where id = ${id} and studio_id = ${studioId}`);
  if (!current) throw new Error("Not found");
  return one<Task>(
    await db()`update tasks set title = ${patch.title?.trim() ?? current.title}, due_on = ${patch.dueOn === undefined ? current.due_on : patch.dueOn}, client_id = ${patch.clientId === undefined ? current.client_id : patch.clientId} where id = ${id} returning *`
  );
}

export async function deleteTask(studioId: string, id: string) {
  await db()`delete from tasks where id = ${id} and studio_id = ${studioId}`;
}

export async function listTasks(studioId: string, view: "open" | "today" | "overdue" | "done" | "all" = "open", clientId?: string | null) {
  return rows<Task>(
    await db()`
      select t.*, c.name as client_name from tasks t left join clients c on c.id = t.client_id
      where t.studio_id = ${studioId}
        and (${clientId ?? null}::uuid is null or t.client_id = ${clientId ?? null}::uuid)
        and case ${view}
              when 'open' then t.done_at is null
              when 'today' then t.done_at is null and t.due_on = current_date
              when 'overdue' then t.done_at is null and t.due_on < current_date
              when 'done' then t.done_at is not null
              else true end
      order by t.done_at nulls first, t.due_on nulls last, t.created_at`
  );
}
