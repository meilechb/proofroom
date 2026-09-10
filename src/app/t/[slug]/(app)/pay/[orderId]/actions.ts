"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db, one } from "@/lib/db";
import { studioBySlug } from "@/lib/tenant-data";
import { agreementForOrder, getOrder, signAgreement } from "@/lib/orders";
import { clientIp } from "@/lib/rate-limit";
import { str, type ActionState } from "@/lib/action-state";

/** Client signs the agreement on the pay page before paying (plan 13.15.2). */
export async function signAgreementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = str(formData, "slug", 80);
  const orderId = str(formData, "orderId", 64);
  const name = str(formData, "name", 120);
  if (!formData.get("agree")) return { error: "Tick the box to agree before signing." };
  if (name.length < 2) return { error: "Type your full name to sign.", fields: { name: "Type your full name." } };

  const studio = await studioBySlug(slug);
  if (!studio) return { error: "Not found." };
  const order = await getOrder(studio.id, orderId);
  if (!order) return { error: "Not found." };
  if (order.contract_signed_at) return { ok: true };

  const agreement = await agreementForOrder(studio.id, order, { studioName: studio.name, studioEmail: studio.email, clientName: (one<{ name: string }>(await db()`select name from clients where id = ${order.client_id}`))?.name ?? "Client" });
  await signAgreement(studio.id, orderId, { name, ip: clientIp(await headers()), version: agreement.version, portfolioOk: formData.get("portfolio") === "on" });
  revalidatePath(`/t/${slug}/pay/${orderId}`);
  return { ok: true };
}
