"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { cancelSlot } from "@/lib/booking";
import { recordClientEvent } from "@/lib/clients";
import { db, one } from "@/lib/db";
import { audit } from "@/lib/audit";
import { str } from "@/lib/action-state";

const OUTCOMES = new Set(["cancelled", "no_show", "completed"]);

/** Cancel, complete, or mark a booking as a no-show from the bookings list. */
export async function setBookingStatusAction(formData: FormData) {
  const { studio, user } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const status = str(formData, "status", 20);
  if (!OUTCOMES.has(status)) return;
  const slot = one<{ id: string; client_id: string | null; order_id: string | null }>(await db()`select id, client_id, order_id from booking_slots where id = ${id} and studio_id = ${studio.id}`);
  if (!slot) return;
  await cancelSlot(studio.id, id, status as "cancelled" | "no_show" | "completed");
  if (slot.client_id) {
    const label = status === "no_show" ? "Booking marked as a no-show" : status === "completed" ? "Booking marked complete" : "Booking cancelled";
    await recordClientEvent(studio.id, slot.client_id, `booking.${status}`, "booking", id, label).catch(() => {});
  }
  await audit({ studioId: studio.id, actorUserId: user.id, action: `booking.${status}`, targetType: "booking_slot", targetId: id, metadata: { order_id: slot.order_id } });
  revalidatePath("/studio/bookings");
  revalidatePath("/studio/calendar");
}
