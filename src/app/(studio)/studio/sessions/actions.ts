"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { createClient, setStage } from "@/lib/clients";
import { createOrder } from "@/lib/orders";
import { orderSchema, fieldErrors, emailSchema } from "@/lib/validation";
import { cents, str, type ActionState } from "@/lib/action-state";

/** Create a session: pick an existing client or create one inline (plan 11.5). */
export async function createSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio();
  let clientId = str(formData, "clientId", 64);

  if (!clientId) {
    const name = str(formData, "newName", 120);
    const emailParsed = emailSchema.safeParse(str(formData, "newEmail", 254));
    if (name.length < 2 || !emailParsed.success) {
      return { error: "Pick a client, or enter a name and a valid email to create one.", fields: { newName: name.length < 2 ? "Enter a name." : "", newEmail: emailParsed.success ? "" : "Enter a valid email." } };
    }
    const { client } = await createClient(studio.id, { name, email: emailParsed.data, stage: "booked" });
    clientId = client.id;
  }

  const parsed = orderSchema.safeParse({
    clientId,
    packageId: str(formData, "packageId", 64) || "",
    title: str(formData, "title", 120),
    scheduledAt: str(formData, "scheduledAt", 40),
    location: str(formData, "location", 200),
    notes: str(formData, "notes", 5000),
    discountCents: cents(formData, "discount"),
  });
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };

  const order = await createOrder(studio.id, {
    clientId,
    packageId: parsed.data.packageId || null,
    title: parsed.data.title || undefined,
    scheduledAt: parsed.data.scheduledAt || null,
    location: parsed.data.location || null,
    notes: parsed.data.notes || null,
    discountCents: parsed.data.discountCents ?? 0,
  });
  await setStage(studio.id, clientId, "booked").catch(() => {});
  revalidatePath("/studio/sessions");
  revalidatePath(`/studio/clients/${clientId}`);
  redirect(`/studio/sessions/${order.id}`);
}
