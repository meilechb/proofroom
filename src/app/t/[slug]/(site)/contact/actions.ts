"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { studioBySlug } from "@/lib/tenant-data";
import { APP_NAME } from "@/lib/env";
import { sendPlatformEmail } from "@/lib/email";
import { clientIp, limited } from "@/lib/rate-limit";
import { emailSchema, fieldErrors } from "@/lib/validation";
import { log } from "@/lib/logger";
import { formValues, str, type ActionState } from "@/lib/action-state";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: emailSchema,
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(5, "Tell us a little more.").max(4000),
});

/** Website contact form → inquiry (+ booking request when a package or date is given). Plan 14.8. */
export async function tenantContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["name", "email", "phone", "message"]);
  const slug = str(formData, "slug", 80);
  if (str(formData, "website", 200)) return { ok: true, message: "Thanks. We will be in touch." }; // honeypot
  const studio = await studioBySlug(slug);
  if (!studio) return { error: "Something went wrong. Please try again." };
  const ip = clientIp(await headers());
  const rl = await limited("contact_form", `${studio.id}:${ip}`);
  if (!rl.ok) return { error: "Too many messages from this network. Try again in a little while.", values };

  const parsed = contactSchema.safeParse({ name: str(formData, "name", 120), email: str(formData, "email", 254), phone: str(formData, "phone", 40) || undefined, message: str(formData, "message", 4000) });
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error), values };
  const data = parsed.data;

  const inquiry = (await db()`
    insert into inquiries (studio_id, name, email, phone, message, source, status)
    values (${studio.id}, ${data.name}, ${data.email}, ${data.phone || null}, ${data.message}, 'website', 'new')
    returning id`)[0] as { id: string } | undefined;

  const packageId = str(formData, "packageId", 64);
  const preferred = str(formData, "preferredDate", 40);
  if (inquiry && (packageId || preferred)) {
    await db()`insert into booking_requests (studio_id, inquiry_id, package_id, preferred_dates) values (${studio.id}, ${inquiry.id}, ${packageId || null}, ${preferred || null})`.catch(() => {});
  }

  const alert = studio.email;
  await sendPlatformEmail({ to: alert, subject: `New inquiry via your ${APP_NAME} website: ${data.name}`, text: `From: ${data.name} <${data.email}>\nPhone: ${data.phone || "—"}\n\n${data.message}`, replyTo: data.email, kind: "website_inquiry" }).catch((e) => log.warn("contact.notify_failed", { error: e instanceof Error ? e.message : String(e) }));
  return { ok: true, message: "Thanks. Your message is on its way." };
}
