"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireWritableStudio } from "@/lib/auth";
import { archiveClient, createClient, mergeClients, recordClientEvent, setStage, updateClient } from "@/lib/clients";
import { clientStages, type ClientStage } from "@/lib/types";
import { clientSchema, fieldErrors } from "@/lib/validation";
import { str, type ActionState } from "@/lib/action-state";

function parseTags(raw: string): string[] {
  return Array.from(new Set(raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))).slice(0, 20);
}

const stageEnum = z.enum(clientStages);

export async function createClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio, user } = await requireWritableStudio();
  const values = { name: str(formData, "name", 120), email: str(formData, "email", 254), phone: str(formData, "phone", 40), company: str(formData, "company", 120) };
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error), values };
  const stage = stageEnum.safeParse(str(formData, "stage", 30));
  const { client, created } = await createClient(studio.id, {
    ...parsed.data,
    phone: parsed.data.phone || null,
    company: parsed.data.company || null,
    stage: stage.success ? stage.data : "lead",
    tags: parseTags(str(formData, "tags", 400)),
    source: str(formData, "source", 60) || "manual",
  });
  if (created) await audit({ studioId: studio.id, actorUserId: user.id, action: "client.created", targetType: "client", targetId: client.id });
  revalidatePath("/studio/clients");
  return { ok: true, message: created ? `${client.name} added.` : `${client.name} already existed; opened their record.`, values: { id: client.id } };
}

export async function updateClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const values = { name: str(formData, "name", 120), email: str(formData, "email", 254), phone: str(formData, "phone", 40), company: str(formData, "company", 120), notes: str(formData, "notes", 5000) };
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error), values };
  await updateClient(studio.id, id, {
    ...parsed.data,
    phone: parsed.data.phone || null,
    company: parsed.data.company || null,
    notes: parsed.data.notes || null,
    tags: parseTags(str(formData, "tags", 400)),
  });
  revalidatePath(`/studio/clients/${id}`);
  revalidatePath("/studio/clients");
  return { ok: true, message: "Saved." };
}

export async function setStageAction(formData: FormData) {
  const { studio } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const stage = stageEnum.safeParse(str(formData, "stage", 30));
  if (!stage.success) return;
  await setStage(studio.id, id, stage.data as ClientStage);
  revalidatePath(`/studio/clients/${id}`);
  revalidatePath("/studio/clients");
}

export async function archiveClientAction(formData: FormData) {
  const { studio, user } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const archive = str(formData, "archive", 5) !== "false";
  await archiveClient(studio.id, id, archive);
  await audit({ studioId: studio.id, actorUserId: user.id, action: archive ? "client.archived" : "client.restored", targetType: "client", targetId: id });
  revalidatePath(`/studio/clients/${id}`);
  revalidatePath("/studio/clients");
}

export async function addNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const body = str(formData, "body", 4000);
  if (!body) return { error: "Write a note first." };
  await recordClientEvent(studio.id, id, "note", null, null, body);
  revalidatePath(`/studio/clients/${id}`);
  return { ok: true, message: "Note added." };
}

export async function logInteractionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const kind = str(formData, "kind", 20) || "call";
  const summary = str(formData, "summary", 2000);
  if (!summary) return { error: "Add a short summary." };
  await recordClientEvent(studio.id, id, `logged.${kind}`, null, null, summary);
  revalidatePath(`/studio/clients/${id}`);
  return { ok: true, message: "Logged." };
}

export async function mergeClientsAction(formData: FormData) {
  const { studio, user } = await requireWritableStudio("admin");
  const keepId = str(formData, "keepId", 64);
  const dropId = str(formData, "dropId", 64);
  if (keepId && dropId && keepId !== dropId) {
    await mergeClients(studio.id, keepId, dropId);
    await audit({ studioId: studio.id, actorUserId: user.id, action: "client.merged", targetType: "client", targetId: keepId, metadata: { dropId } });
  }
  revalidatePath("/studio/clients");
  revalidatePath(`/studio/clients/${keepId}`);
}
