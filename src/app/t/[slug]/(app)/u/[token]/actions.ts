"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { studioBySlug } from "@/lib/tenant-data";
import { verifyLink } from "@/lib/tenant-tokens";
import { str } from "@/lib/action-state";

export async function setSubscriptionAction(formData: FormData) {
  const slug = str(formData, "slug", 80);
  const token = str(formData, "token", 400);
  const subscribe = str(formData, "subscribe", 5) === "true";
  const studio = await studioBySlug(slug);
  const clientId = verifyLink("unsub", token);
  if (studio && clientId) {
    await db()`update clients set unsubscribed_at = ${subscribe ? null : new Date().toISOString()} where id = ${clientId} and studio_id = ${studio.id}`;
    if (!subscribe) {
      const email = (await db()`select email from clients where id = ${clientId}`)[0] as { email: string } | undefined;
      if (email) await db()`insert into suppressions (studio_id, email, reason) values (${studio.id}, ${email.email.toLowerCase()}, 'unsubscribe') on conflict (studio_id, email) do nothing`;
    } else {
      const email = (await db()`select email from clients where id = ${clientId}`)[0] as { email: string } | undefined;
      if (email) await db()`delete from suppressions where studio_id = ${studio.id} and email = ${email.email.toLowerCase()} and reason = 'unsubscribe'`;
    }
  }
  revalidatePath(`/t/${slug}/u/${token}`);
}
