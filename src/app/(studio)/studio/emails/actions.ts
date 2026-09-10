"use server";

import { revalidatePath } from "next/cache";
import { requireStudio, requireWritableStudio } from "@/lib/auth";
import { saveTemplate, resetTemplate } from "@/lib/email-templates-server";
import { renderTemplate, templatesByKey, templateKeys, type TemplateKey, type TemplateValues } from "@/lib/email-templates";
import { sendStudioEmail } from "@/lib/email";
import { str, type ActionState } from "@/lib/action-state";

function asKey(v: string): TemplateKey | null {
  return (templateKeys as readonly string[]).includes(v) ? (v as TemplateKey) : null;
}

/** Sender display name (plan 16.3). The from-address comes from the verified sending domain; reply-to is the studio email. */
export async function saveSenderNameAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio("admin");
  const name = str(formData, "from_name", 80);
  await (await import("@/lib/db")).db()`update studios set settings = settings || ${JSON.stringify({ email_from_name: name })}::jsonb where id = ${studio.id}`;
  revalidatePath("/studio/emails");
  return { ok: true, message: "Saved." };
}

export async function saveTemplateAction(key: string, values: TemplateValues): Promise<ActionState> {
  const { studio } = await requireWritableStudio("admin");
  const k = asKey(key);
  if (!k) return { error: "Unknown template." };
  if (!values.subject.trim() || !values.body.trim()) return { error: "Subject and body are both required." };
  await saveTemplate(studio.id, k, values);
  revalidatePath("/studio/emails");
  revalidatePath(`/studio/emails/${k}`);
  return { ok: true, message: "Saved." };
}

export async function resetTemplateAction(key: string): Promise<void> {
  const { studio } = await requireWritableStudio("admin");
  const k = asKey(key);
  if (!k) return;
  await resetTemplate(studio.id, k);
  revalidatePath("/studio/emails");
  revalidatePath(`/studio/emails/${k}`);
}

/** Send the template to the signed-in owner with sample data (plan 16.2.4). */
export async function testSendTemplateAction(key: string, values: TemplateValues): Promise<ActionState> {
  const { studio, user } = await requireStudio("admin");
  const k = asKey(key);
  if (!k) return { error: "Unknown template." };
  const def = templatesByKey[k];
  const sample = { studio_name: studio.name, studio_email: studio.email, client_name: "Sample Client", ...def.sample };
  const subject = renderTemplate(values.subject, sample);
  const body = renderTemplate(values.body, sample);
  const res = await sendStudioEmail(studio, {
    to: user.email,
    subject: `[Test] ${subject}`,
    text: body,
    cta: def.hasCta && values.cta_label ? { label: values.cta_label, url: "https://example.com" } : undefined,
    kind: "test",
  });
  if (res.skipped) return { error: "Email is not configured on this deployment, so no test could be sent." };
  return res.ok ? { ok: true, message: `Sent a test to ${user.email}.` } : { error: res.error || "Could not send the test email." };
}
