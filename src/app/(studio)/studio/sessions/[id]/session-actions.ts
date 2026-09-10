"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireWritableStudio } from "@/lib/auth";
import { cancelOrder, getOrder, updateOrder } from "@/lib/orders";
import { markOrderNoShow } from "@/lib/booking";
import { recordClientEvent } from "@/lib/clients";
import { recordManualPayment, undoManualPayment } from "@/lib/payments";
import { cents, str, type ActionState } from "@/lib/action-state";

export async function editSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const title = str(formData, "title", 120);
  if (title.length < 1) return { error: "Give the session a title.", fields: { title: "Required." } };
  try {
    await updateOrder(studio.id, id, {
      title,
      location: str(formData, "location", 200) || null,
      notes: str(formData, "notes", 5000) || null,
      scheduled_at: str(formData, "scheduledAt", 40) || null,
      discount_cents: cents(formData, "discount"),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save." };
  }
  revalidatePath(`/studio/sessions/${id}`);
  return { ok: true, message: "Session saved." };
}

export async function cancelSessionAction(formData: FormData) {
  const { studio, user } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  await cancelOrder(studio.id, id, str(formData, "reason", 500) || null);
  await audit({ studioId: studio.id, actorUserId: user.id, action: "order.cancelled", targetType: "order", targetId: id });
  revalidatePath(`/studio/sessions/${id}`);
  revalidatePath("/studio/sessions");
}

export async function markNoShowAction(formData: FormData) {
  const { studio, user } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const order = await getOrder(studio.id, id);
  const slot = await markOrderNoShow(studio.id, id);
  if (slot && order) {
    await recordClientEvent(studio.id, order.client_id, "booking.no_show", "order", id, `Session #${order.order_number} marked as a no-show`);
    await audit({ studioId: studio.id, actorUserId: user.id, action: "booking.no_show", targetType: "order", targetId: id });
  }
  revalidatePath(`/studio/sessions/${id}`);
}

export async function manualPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio, user } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const amount = cents(formData, "amount");
  if (amount <= 0) return { error: "Enter an amount greater than zero.", fields: { amount: "Enter an amount." } };
  const order = await getOrder(studio.id, id);
  if (!order) return { error: "Session not found." };
  await recordManualPayment(studio.id, id, amount, str(formData, "method", 30) || "cash", str(formData, "note", 500) || null, user.id);
  revalidatePath(`/studio/sessions/${id}`);
  return { ok: true, message: "Payment recorded." };
}

export async function undoManualPaymentAction(formData: FormData) {
  const { studio } = await requireWritableStudio();
  const paymentId = str(formData, "paymentId", 64);
  const orderId = str(formData, "orderId", 64);
  await undoManualPayment(studio.id, paymentId);
  revalidatePath(`/studio/sessions/${orderId}`);
}
