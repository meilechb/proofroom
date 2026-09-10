"use server";

import { revalidatePath } from "next/cache";
import { requireStudio, requireWritableStudio } from "@/lib/auth";
import { createDomain, verifyDomain, removeDomain, setFromLocalPart } from "@/lib/sending-domains";
import { sendStudioEmail } from "@/lib/email";
import { audit } from "@/lib/audit";
import { str, type ActionState } from "@/lib/action-state";

export async function addEmailDomainAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio, user } = await requireWritableStudio("admin");
  const domain = str(formData, "domain", 253);
  try {
    await createDomain(studio.id, domain);
    await audit({ studioId: studio.id, actorUserId: user.id, action: "email_domain.added", metadata: { domain } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add that domain.";
    return { error: message, fields: { domain: message } };
  }
  revalidatePath("/studio/settings/email-domain");
  return { ok: true, message: "Added. Create the DNS records below, then check again." };
}

export async function checkEmailDomainAction(): Promise<void> {
  const { studio } = await requireWritableStudio("admin");
  await verifyDomain(studio.id).catch(() => {});
  revalidatePath("/studio/settings/email-domain");
}

export async function setFromLocalPartAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio("admin");
  try {
    await setFromLocalPart(studio.id, str(formData, "local_part", 64));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save.";
    return { error: message, fields: { local_part: message } };
  }
  revalidatePath("/studio/settings/email-domain");
  return { ok: true, message: "Saved." };
}

export async function testEmailDomainAction(): Promise<ActionState> {
  const { studio, user } = await requireStudio("admin");
  const res = await sendStudioEmail(studio, {
    to: user.email,
    subject: "Test email from your studio domain",
    text: `This is a test. If you received it and the sender is your own domain, your email domain is working.\n\n${studio.name}`,
    kind: "domain_test",
  });
  if (res.skipped) return { error: "Email is not configured on this deployment." };
  return res.ok ? { ok: true, message: `Sent a test to ${user.email}.` } : { error: res.error || "Could not send the test." };
}

export async function removeEmailDomainAction(): Promise<void> {
  const { studio, user } = await requireWritableStudio("admin");
  await removeDomain(studio.id);
  await audit({ studioId: studio.id, actorUserId: user.id, action: "email_domain.removed" });
  revalidatePath("/studio/settings/email-domain");
}
