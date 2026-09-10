"use server";

import { requireStudio, requireWritableStudio } from "@/lib/auth";
import { getEmailLogEntry } from "@/lib/email-events";
import { sendStudioEmail } from "@/lib/email";
import type { ActionState } from "@/lib/action-state";

export async function getEmailDetailAction(id: string) {
  const { studio } = await requireStudio("admin");
  return getEmailLogEntry(studio.id, id);
}

/** Re-send a logged email to the same recipient (plan 16.4). */
export async function resendEmailAction(id: string): Promise<ActionState> {
  const { studio } = await requireWritableStudio("admin");
  const entry = await getEmailLogEntry(studio.id, id);
  if (!entry) return { error: "That email is no longer in the log." };
  if (!entry.body) return { error: "This email has no stored body to resend." };
  const res = await sendStudioEmail(studio, { to: entry.to_address, subject: entry.subject, text: entry.body, kind: "resend" });
  if (res.skipped) return { error: "Email is not configured, or this address is suppressed." };
  return res.ok ? { ok: true, message: `Resent to ${entry.to_address}.` } : { error: res.error || "Could not resend." };
}
