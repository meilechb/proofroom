"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireWritableStudio } from "@/lib/auth";
import { createClient, recordClientEvent } from "@/lib/clients";
import { getInquiry, markInquiry, studioTemplate } from "@/lib/inbox";
import { renderTemplate } from "@/lib/email-templates";
import { sendStudioEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { emailSchema, fieldErrors } from "@/lib/validation";
import { z } from "zod";
import { str, type ActionState } from "@/lib/action-state";

export async function markInquiriesAction(formData: FormData) {
  const { studio } = await requireWritableStudio();
  const ids = formData.getAll("id").map(String).filter(Boolean);
  const status = str(formData, "status", 20);
  if (status === "new" || status === "read" || status === "archived") await markInquiry(studio.id, ids, status);
  revalidatePath("/studio/inbox");
}

/** Create or link a client from an inquiry and move them to lead (plan 10.4). */
export async function convertToClientAction(formData: FormData): Promise<void> {
  const { studio, user } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const inq = await getInquiry(studio.id, id);
  if (!inq) return;
  const { client } = await createClient(studio.id, { name: inq.name, email: inq.email, phone: inq.phone, stage: "lead", source: inq.source ?? "inbox" });
  await db()`update inquiries set client_id = ${client.id}, status = case when status = 'new' then 'read' else status end where id = ${id} and studio_id = ${studio.id}`;
  await recordClientEvent(studio.id, client.id, "inquiry.linked", "inquiry", id, `Linked inquiry: ${inq.message?.slice(0, 120) ?? "(no message)"}`);
  await audit({ studioId: studio.id, actorUserId: user.id, action: "inquiry.converted", targetType: "client", targetId: client.id });
  revalidatePath("/studio/inbox");
}

const replySchema = z.object({ to: emailSchema, subject: z.string().trim().min(1, "Add a subject.").max(200), body: z.string().trim().min(1, "Write a message.").max(10000) });

export async function replyInquiryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const parsed = replySchema.safeParse({ to: str(formData, "to", 254), subject: str(formData, "subject", 200), body: str(formData, "body", 10000) });
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const inq = await getInquiry(studio.id, id);
  if (!inq) return { error: "This inquiry no longer exists." };

  const result = await sendStudioEmail(studio, { to: parsed.data.to, subject: parsed.data.subject, text: parsed.data.body, kind: "inquiry_reply", related: inq.client_id ? { type: "client", id: inq.client_id } : null });
  if (!result.ok && !result.skipped) return { error: `The email could not be sent: ${result.error ?? "unknown error"}.` };
  await markInquiry(studio.id, [id], "read");
  if (inq.client_id) await recordClientEvent(studio.id, inq.client_id, "email", "inquiry", id, `Replied: ${parsed.data.subject}`);
  revalidatePath("/studio/inbox");
  return { ok: true, message: result.skipped ? "Email is not configured on this deployment, so nothing was sent." : `Reply sent to ${parsed.data.to}.` };
}
