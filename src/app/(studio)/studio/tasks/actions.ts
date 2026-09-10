"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { completeTask, createTask, deleteTask, updateTask } from "@/lib/tasks";
import { str, type ActionState } from "@/lib/action-state";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function createTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio, user } = await requireWritableStudio();
  const title = str(formData, "title", 200);
  if (!title) return { error: "Enter a task." };
  const due = str(formData, "due_on", 10);
  await createTask(studio.id, { title, dueOn: DATE_RE.test(due) ? due : null, clientId: str(formData, "client_id", 64) || null, createdBy: user.id });
  revalidatePath("/studio/tasks");
  return { ok: true, message: "Task added." };
}

export async function completeTaskAction(formData: FormData) {
  const { studio } = await requireWritableStudio();
  await completeTask(studio.id, str(formData, "id", 64), str(formData, "done", 5) !== "false");
  revalidatePath("/studio/tasks");
  const back = str(formData, "back", 200);
  if (back.startsWith("/studio/clients/")) revalidatePath(back);
}

export async function updateTaskAction(formData: FormData) {
  const { studio } = await requireWritableStudio();
  const due = str(formData, "due_on", 10);
  await updateTask(studio.id, str(formData, "id", 64), { title: str(formData, "title", 200) || undefined, dueOn: DATE_RE.test(due) ? due : null });
  revalidatePath("/studio/tasks");
}

export async function deleteTaskAction(formData: FormData) {
  const { studio } = await requireWritableStudio();
  await deleteTask(studio.id, str(formData, "id", 64));
  revalidatePath("/studio/tasks");
}
