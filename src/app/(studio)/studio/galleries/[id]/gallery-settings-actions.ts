"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireWritableStudio } from "@/lib/auth";
import { archiveGallery, duplicateFinalsFromFavorites, getGallery, publishGallery, regenerateAccessCode, unpublishGallery, updateGallerySettings } from "@/lib/galleries";
import { sendStudioEmail } from "@/lib/email";
import { studioTemplate } from "@/lib/inbox";
import { renderTemplate } from "@/lib/email-templates";
import { recordClientEvent } from "@/lib/clients";
import { galleryUrl } from "@/lib/tenant";
import { db, one } from "@/lib/db";
import { bool, str, type ActionState } from "@/lib/action-state";

export async function saveGallerySettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const title = str(formData, "title", 120);
  if (title.length < 1) return { error: "Give the gallery a title.", fields: { title: "Required." } };
  const download = str(formData, "download_size", 10);
  const expires = str(formData, "expires_at", 10);
  await updateGallerySettings(studio.id, id, {
    title,
    welcome_message: str(formData, "welcome_message", 2000) || null,
    allow_downloads: download !== "off",
    download_size: download === "off" ? "web" : (download as "web" | "full" | "both"),
    pay_gated: bool(formData, "pay_gated"),
    allow_comments: bool(formData, "allow_comments"),
    allow_sharing: bool(formData, "allow_sharing"),
    watermark: bool(formData, "watermark"),
    sort_mode: (["manual", "filename", "captured"].includes(str(formData, "sort_mode", 12)) ? str(formData, "sort_mode", 12) : "manual") as "manual" | "filename" | "captured",
    expires_at: /^\d{4}-\d{2}-\d{2}$/.test(expires) ? new Date(`${expires}T23:59:59Z`).toISOString() : null,
    password: str(formData, "password", 100) || (formData.has("clear_password") ? null : undefined),
    download_pin: str(formData, "download_pin", 20) || (formData.has("clear_pin") ? null : undefined),
  });
  revalidatePath(`/studio/galleries/${id}`);
  return { ok: true, message: "Settings saved." };
}

export async function publishGalleryAction(formData: FormData) {
  const { studio, user } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const publish = str(formData, "publish", 5) !== "false";
  if (publish) await publishGallery(studio.id, id);
  else await unpublishGallery(studio.id, id);
  await audit({ studioId: studio.id, actorUserId: user.id, action: publish ? "gallery.published" : "gallery.unpublished", targetType: "gallery", targetId: id });
  revalidatePath(`/studio/galleries/${id}`);
}

export async function archiveGalleryAction(formData: FormData) {
  const { studio } = await requireWritableStudio();
  await archiveGallery(studio.id, str(formData, "id", 64));
  revalidatePath("/studio/galleries");
  redirect("/studio/galleries");
}

export async function regenerateCodeAction(formData: FormData) {
  const { studio } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  await regenerateAccessCode(studio.id, id);
  revalidatePath(`/studio/galleries/${id}`);
}

export async function createFinalsFromFavoritesAction(formData: FormData) {
  const { studio } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const finals = await duplicateFinalsFromFavorites(studio.id, id);
  revalidatePath(`/studio/galleries/${id}`);
  if (finals?.gallery) redirect(`/studio/galleries/${finals.gallery.id}`);
}

export async function sendGalleryEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  const gallery = await getGallery(studio.id, id);
  if (!gallery) return { error: "Gallery not found." };
  if (gallery.status !== "published") return { error: "Publish the gallery before sending it." };
  const client = one<{ name: string; email: string }>(await db()`select name, email from clients where id = ${gallery.client_id} and studio_id = ${studio.id}`);
  if (!client) return { error: "This gallery has no client." };
  const to = str(formData, "to", 254) || client.email;
  const key = gallery.kind === "final" ? "gallery_final" : "gallery_proofs";
  const tpl = await studioTemplate(studio.id, key);
  const url = galleryUrl(studio, gallery.slug);
  const vars = { client_name: client.name.split(" ")[0] || client.name, gallery_title: gallery.title, gallery_url: url, access_code: gallery.access_code ?? "", retention_days: "90" };
  const result = await sendStudioEmail(studio, {
    to,
    subject: renderTemplate(str(formData, "subject", 200) || tpl.subject, vars),
    text: renderTemplate(str(formData, "body", 10000) || tpl.body, vars),
    cta: { label: tpl.cta_label || "View gallery", url },
    kind: key,
    related: { type: "gallery", id: gallery.id },
  });
  if (!result.ok && !result.skipped) return { error: `Could not send: ${result.error ?? "unknown error"}.` };
  await recordClientEvent(studio.id, gallery.client_id, "gallery.sent", "gallery", gallery.id, `Sent “${gallery.title}” to ${to}`);
  revalidatePath(`/studio/galleries/${id}`);
  return { ok: true, message: result.skipped ? "Email is not configured on this deployment; nothing was sent." : `Sent to ${to}.` };
}
