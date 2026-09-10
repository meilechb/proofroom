"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireStudio, requireWritableStudio } from "@/lib/auth";
import { createApiToken } from "@/lib/api-tokens";
import { db } from "@/lib/db";
import { describeImageError, makeLogo } from "@/lib/images";
import { updatePackage } from "@/lib/packages";
import { TEMPLATES } from "@/lib/site/schema";
import { assetPath, putPublic, storageConfigured } from "@/lib/storage";
import { emailSchema, hexColor } from "@/lib/validation";
import { cents, int, str, type ActionState } from "@/lib/action-state";

import { WIZARD_STEPS } from "./steps";

/** Onboarding wizard (plan 9.5). Each action saves one step and moves to the next. */

async function setStep(studioId: string, step: number) {
  await db()`update studios set onboarding = onboarding || ${JSON.stringify({ wizard_step: step })}::jsonb where id = ${studioId}`;
}

function next(step: number): never {
  redirect(`/studio/welcome?step=${Math.min(WIZARD_STEPS, step)}`);
}

const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

export async function saveBrandAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio, user } = await requireWritableStudio("admin");
  const name = str(formData, "name", 120);
  const color = str(formData, "color", 7);
  if (name.length < 2) return { error: "Enter your studio name.", fields: { name: "Enter your studio name." } };
  const parsedColor = hexColor.safeParse(color);
  if (!parsedColor.success) return { error: "Use a hex color like #1A2B3C.", fields: { color: "Use a hex color like #1A2B3C." } };

  let logoUrl: string | null = null;
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (!LOGO_TYPES.includes(logo.type)) return { error: "Upload a PNG, JPEG, WebP, GIF or SVG logo.", fields: { logo: "Unsupported file type." } };
    if (logo.size > 5 * 1024 * 1024) return { error: "The logo must be under 5 MB.", fields: { logo: "Under 5 MB, please." } };
    if (!storageConfigured()) return { error: "File storage is not configured on this deployment yet. Skip the logo for now." };
    try {
      const input = Buffer.from(await logo.arrayBuffer());
      const stored = logo.type === "image/svg+xml" ? { buffer: input, contentType: "image/svg+xml" } : await makeLogo(input);
      const ext = stored.contentType === "image/png" ? "png" : stored.contentType === "image/svg+xml" ? "svg" : "jpg";
      const blob = await putPublic(assetPath(studio.id, `logo.${ext}`), stored.buffer, stored.contentType);
      logoUrl = blob.url;
    } catch (error) {
      return { error: describeImageError(error) };
    }
  }

  await db()`
    update studios set
      name = ${name},
      brand_color = ${parsedColor.data.toLowerCase()},
      logo_url = coalesce(${logoUrl}, logo_url),
      site = case when site_published_at is null then jsonb_set(site, '{settings,colors,primary}', to_jsonb(${parsedColor.data.toLowerCase()}::text), true) else site end
    where id = ${studio.id}`;
  await audit({ studioId: studio.id, actorUserId: user.id, action: "studio.brand_updated" });
  await setStep(studio.id, 2);
  revalidatePath("/studio", "layout");
  next(2);
}

export async function saveTemplateAction(formData: FormData) {
  const { studio, user } = await requireWritableStudio("admin");
  const parsed = z.enum(TEMPLATES).safeParse(str(formData, "template", 20));
  if (!parsed.success) redirect("/studio/welcome?step=2&error=template");
  await db()`
    update studios set
      site_template = ${parsed.data},
      site = jsonb_set(site, '{settings,template}', to_jsonb(${parsed.data}::text), true),
      site_draft = case when site_draft is null then null else jsonb_set(site_draft, '{settings,template}', to_jsonb(${parsed.data}::text), true) end
    where id = ${studio.id}`;
  await audit({ studioId: studio.id, actorUserId: user.id, action: "site.template_changed", metadata: { template: parsed.data } });
  await setStep(studio.id, 3);
  next(3);
}

export async function savePackagesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio("admin");
  const ids = formData.getAll("id").map(String).slice(0, 12);
  const fields: Record<string, string> = {};
  for (const id of ids) {
    const name = str(formData, `name_${id}`, 80);
    const price = cents(formData, `price_${id}`, -1);
    const deposit = cents(formData, `deposit_${id}`, -1);
    const included = int(formData, `included_${id}`, -1);
    const extra = cents(formData, `extra_${id}`, -1);
    if (name.length < 2) fields[`name_${id}`] = "Give the package a name.";
    if (price < 0) fields[`price_${id}`] = "Enter a price.";
    if (deposit < 0 || deposit > price) fields[`deposit_${id}`] = "The deposit cannot be more than the price.";
    if (included < 0) fields[`included_${id}`] = "How many finished photos are included?";
    if (extra < 0) fields[`extra_${id}`] = "Enter a price per extra photo, or 0.";
  }
  if (Object.keys(fields).length) return { error: "Please fix the highlighted fields.", fields };
  for (const id of ids) {
    await updatePackage(studio.id, id, {
      name: str(formData, `name_${id}`, 80),
      priceCents: cents(formData, `price_${id}`),
      depositCents: cents(formData, `deposit_${id}`),
      includedFinals: int(formData, `included_${id}`),
      extraFinalCents: cents(formData, `extra_${id}`),
      isActive: formData.get(`active_${id}`) === "on",
    });
  }
  await setStep(studio.id, 4);
  next(4);
}

export async function saveEmailSenderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio, user } = await requireWritableStudio("admin");
  const fromName = str(formData, "fromName", 80);
  const replyTo = emailSchema.safeParse(str(formData, "replyTo", 254));
  if (fromName.length < 2) return { error: "Enter the name clients should see.", fields: { fromName: "Enter a display name." } };
  if (!replyTo.success) return { error: "Enter a valid reply-to address.", fields: { replyTo: "Enter a valid email address." } };
  await db()`
    update studios set
      email = ${replyTo.data},
      settings = settings || ${JSON.stringify({ email_from_name: fromName })}::jsonb
    where id = ${studio.id}`;
  await audit({ studioId: studio.id, actorUserId: user.id, action: "studio.email_sender_updated" });
  await setStep(studio.id, 6);
  next(6);
}

export async function createWizardTokenAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  void formData;
  const { studio, user } = await requireWritableStudio("admin");
  const created = await createApiToken(studio.id, user.id, `Lightroom (${user.name.split(" ")[0] || "setup"})`);
  await audit({ studioId: studio.id, actorUserId: user.id, action: "api_token.created", targetType: "api_token", targetId: created.id });
  await setStep(studio.id, 6);
  return { ok: true, message: created.token };
}

/** "Skip" and "Back" links move the saved step without saving anything. */
export async function goToStepAction(formData: FormData) {
  const { studio } = await requireStudio("admin");
  const step = Math.min(WIZARD_STEPS, Math.max(1, int(formData, "step", 1)));
  await setStep(studio.id, step);
  next(step);
}

export async function finishWizardAction() {
  const { studio, user } = await requireStudio("admin");
  await db()`update studios set onboarding = onboarding || '{"wizard_done": true}'::jsonb where id = ${studio.id}`;
  await audit({ studioId: studio.id, actorUserId: user.id, action: "studio.onboarding_finished" });
  revalidatePath("/studio", "layout");
  redirect("/studio?welcome=1");
}
