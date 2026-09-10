"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { db } from "@/lib/db";
import { validTimezone } from "@/lib/account";
import { str, type ActionState } from "@/lib/action-state";

const CURRENCIES = ["usd", "eur", "gbp", "cad", "aud", "nzd", "chf", "sek", "dkk", "nok"];

/** Studio profile: business identity and locale (plan 17.2). */
export async function saveProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio("admin");
  const name = str(formData, "name", 120);
  const email = str(formData, "email", 254);
  if (!name) return { error: "Studio name is required.", fields: { name: "Required." } };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email.", fields: { email: "Enter a valid email." } };
  const timezone = str(formData, "timezone", 64);
  if (!validTimezone(timezone)) return { error: "That timezone is not recognized.", fields: { timezone: "Use a name like America/New_York." } };
  const currency = str(formData, "currency", 8).toLowerCase();
  if (!CURRENCIES.includes(currency)) return { error: "Choose a supported currency.", fields: { currency: "Unsupported currency." } };

  const settingsPatch = {
    address: str(formData, "address", 300),
    business_hours: str(formData, "business_hours", 400),
  };

  await db()`
    update studios set
      name = ${name}, legal_name = ${str(formData, "legal_name", 200) || null}, email = ${email},
      phone = ${str(formData, "phone", 40) || null}, timezone = ${timezone}, currency = ${currency},
      settings = settings || ${JSON.stringify(settingsPatch)}::jsonb, updated_at = now()
    where id = ${studio.id}`;
  revalidatePath("/studio/settings");
  return { ok: true, message: "Saved." };
}
