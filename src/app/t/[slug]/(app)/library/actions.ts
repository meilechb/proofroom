"use server";

import { headers } from "next/headers";
import { studioBySlug } from "@/lib/tenant-data";
import { listPaidSalesForBuyer } from "@/lib/store";
import { signLink } from "@/lib/tenant-tokens";
import { storeLibraryUrl } from "@/lib/tenant";
import { sendStoreDeliveryEmail } from "@/lib/emails/studio";
import { clientIp, limited } from "@/lib/rate-limit";
import { formatMoney } from "@/lib/types";
import { str, type ActionState } from "@/lib/action-state";

/**
 * Buyer lost their delivery email: re-mint and re-send a library link to their
 * most recent order. Always returns the same generic message (no order
 * enumeration) and is rate-limited.
 */
export async function resendLibraryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = str(formData, "slug", 80);
  const email = str(formData, "email", 254).toLowerCase();
  const generic: ActionState = { ok: true, message: "If we found an order for that email, we've sent a fresh download link." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };
  const studio = await studioBySlug(slug);
  if (!studio) return generic;
  const rl = await limited("store_checkout", `resend:${studio.id}:${clientIp(await headers())}`);
  if (!rl.ok) return { error: "Too many requests. Try again in a few minutes." };
  const sale = (await listPaidSalesForBuyer(studio.id, email)).find((s) => s.status === "paid" || s.status === "partially_refunded");
  if (sale) {
    const url = storeLibraryUrl(studio, signLink("download", sale.id));
    await sendStoreDeliveryEmail(
      { id: studio.id, name: studio.name, email: studio.email },
      { to: email, buyerName: sale.buyer_name, amount: formatMoney(sale.total_cents, sale.currency), orderNumber: sale.order_number, url }
    ).catch(() => undefined);
  }
  return generic;
}
