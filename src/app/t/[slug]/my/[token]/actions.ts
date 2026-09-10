"use server";

import { db, one } from "@/lib/db";
import { studioBySlug } from "@/lib/tenant-data";
import { signLink } from "@/lib/tenant-tokens";
import { clientHubUrl } from "@/lib/tenant";
import { sendStudioEmail } from "@/lib/email";
import { limited, clientIp } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { emailSchema } from "@/lib/validation";
import { str, type ActionState } from "@/lib/action-state";

/** Emails a fresh 7-day hub link if the address matches a client (plan 13.18). Same reply either way. */
export async function requestHubLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = str(formData, "slug", 80);
  const parsed = emailSchema.safeParse(str(formData, "email", 254));
  const done = { ok: true, message: "If that email is on file, a new link is on its way." };
  if (!parsed.success) return { error: "Enter a valid email address." };
  const studio = await studioBySlug(slug);
  if (!studio) return done;
  const rl = await limited("verify_resend", `hub:${clientIp(await headers())}`);
  if (!rl.ok) return { error: "Please wait a few minutes and try again." };
  const client = one<{ id: string }>(await db()`select id from clients where studio_id = ${studio.id} and lower(email) = ${parsed.data} and not archived limit 1`);
  if (client) {
    const url = clientHubUrl(studio, signLink("hub", client.id));
    await sendStudioEmail(studio, { to: parsed.data, subject: `Your ${studio.name} client portal`, text: `Here is your link to view your galleries, sessions and invoices with ${studio.name}. It works for 7 days.`, cta: { label: "Open my portal", url }, kind: "hub_link" }).catch(() => {});
  }
  return done;
}
