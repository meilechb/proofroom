"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { db, dbConfigured } from "@/lib/db";
import { APP_NAME, env } from "@/lib/env";
import { sendPlatformEmail } from "@/lib/email";
import { log } from "@/lib/logger";
import { clientIp, limited } from "@/lib/rate-limit";
import { fieldErrors } from "@/lib/validation";
import { formValues, str, type ActionState } from "@/lib/action-state";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  studio: z.string().trim().max(120).optional(),
  message: z.string().trim().min(10, "Tell us a little more.").max(4000),
});

/** Contact form: rate limited, honeypot, stored in leads, notice to PLATFORM_ALERT_EMAIL (plan 8.16). */
export async function contactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["name", "email", "studio", "message"]);
  const ip = clientIp(await headers());
  if (str(formData, "website", 200)) {
    log.warn("contact.honeypot", { ip });
    return { ok: true, message: "Thanks, we will be in touch." };
  }
  const rl = await limited("contact_form", ip);
  if (!rl.ok) return { error: "Too many messages from this network. Try again in an hour.", values };

  const parsed = contactSchema.safeParse({ name: str(formData, "name", 120), email: str(formData, "email", 254), studio: str(formData, "studio", 120) || undefined, message: str(formData, "message", 4000) });
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error), values };
  const data = parsed.data;

  if (dbConfigured()) {
    await db()`insert into leads (email, name, message, source) values (${data.email}, ${data.name}, ${data.studio ? `[${data.studio}] ${data.message}` : data.message}, 'contact')`;
  }
  const alertTo = env.platformAlertEmail();
  if (alertTo) {
    await sendPlatformEmail({
      to: alertTo,
      subject: `${APP_NAME} contact: ${data.name}`,
      text: `From: ${data.name} <${data.email}>\nStudio: ${data.studio ?? "(not given)"}\nIP: ${ip}\n\n${data.message}`,
      replyTo: data.email,
      kind: "contact_notice",
    }).catch((error) => log.warn("contact.notice_failed", { error: error instanceof Error ? error.message : String(error) }));
  }
  log.info("contact.received", { email: data.email });
  return { ok: true, message: "Thanks. Your message is in; we reply within one business day." };
}
