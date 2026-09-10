"use server";

import { headers } from "next/headers";
import { db, one } from "@/lib/db";
import { studioBySlug, galleryBySlug } from "@/lib/tenant-data";
import { grantGalleryAccess, unlockAttemptAllowed, verifyUnlock } from "@/lib/gallery-access";
import { recordClientEvent } from "@/lib/clients";
import { clientIp } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { str, type ActionState } from "@/lib/action-state";

const NAME_COOKIE = "pr_visitor";

export async function unlockGalleryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = str(formData, "slug", 80);
  const gslug = str(formData, "gslug", 120);
  const studio = await studioBySlug(slug);
  if (!studio) return { error: "This gallery could not be found." };
  const gallery = await galleryBySlug(studio.id, gslug);
  if (!gallery) return { error: "This gallery could not be found." };

  const ip = clientIp(await headers());
  if (!unlockAttemptAllowed(gallery.id, ip)) return { error: "Too many tries. Wait a few minutes and try again." };
  if (!verifyUnlock(gallery, str(formData, "code", 100))) return { error: "That code or password is not right." };
  await grantGalleryAccess(gallery.id);
  return { ok: true };
}

export async function toggleFavoriteAction(galleryId: string, photoId: string, selected: boolean) {
  const gallery = one<{ studio_id: string; allow_comments: boolean; status: string }>(await db()`select studio_id, allow_comments, status from galleries where id = ${galleryId}`);
  if (!gallery || gallery.status !== "published" || !gallery.allow_comments) return { ok: false };
  const photo = one<{ id: string }>(await db()`select id from photos where id = ${photoId} and gallery_id = ${galleryId} and deleted_at is null`);
  if (!photo) return { ok: false };
  await db()`
    insert into photo_selections (photo_id, studio_id, gallery_id, selected, updated_at)
    values (${photoId}, ${gallery.studio_id}, ${galleryId}, ${selected}, now())
    on conflict (photo_id) do update set selected = ${selected}, updated_at = now()`;
  return { ok: true };
}

export async function addNoteAction(galleryId: string, photoId: string, body: string, name: string) {
  const text = body.trim().slice(0, 2000);
  if (!text) return { ok: false };
  const gallery = one<{ studio_id: string; client_id: string; allow_comments: boolean; status: string }>(await db()`select studio_id, client_id, allow_comments, status from galleries where id = ${galleryId}`);
  if (!gallery || gallery.status !== "published" || !gallery.allow_comments) return { ok: false };
  const photo = one<{ id: string }>(await db()`select id from photos where id = ${photoId} and gallery_id = ${galleryId} and deleted_at is null`);
  if (!photo) return { ok: false };
  const author = (name || (await cookies()).get(NAME_COOKIE)?.value || "Client").trim().slice(0, 120);
  if (name) (await cookies()).set(NAME_COOKIE, author, { httpOnly: false, sameSite: "lax", path: "/", maxAge: 90 * 86400 });
  await db()`insert into photo_comments (studio_id, photo_id, gallery_id, author_name, author_role, body) values (${gallery.studio_id}, ${photoId}, ${galleryId}, ${author}, 'client', ${text})`;
  await recordClientEvent(gallery.studio_id, gallery.client_id, "gallery.note", "gallery", galleryId, `Note on a photo: ${text.slice(0, 100)}`).catch(() => {});
  return { ok: true, author };
}

/** Client-side upload when the studio enabled it (plan 13.13). Guarded by the access cookie. */
export async function clientBeginUploadAction(galleryId: string, meta: { filename: string; size: number; contentType: string; sha256: string | null }) {
  const { beginUpload } = await import("@/lib/photos");
  const gallery = one<{ id: string; studio_id: string; allow_client_upload: boolean; status: string }>(await db()`select id, studio_id, allow_client_upload, status from galleries where id = ${galleryId}`);
  if (!gallery || gallery.status !== "published" || !gallery.allow_client_upload) throw new Error("Uploads are not open for this gallery.");
  const { hasGalleryAccess, unlockMethod } = await import("@/lib/gallery-access");
  const full = one<{ access_code: string | null; password_hash: string | null }>(await db()`select access_code, password_hash from galleries where id = ${galleryId}`);
  const open = full && unlockMethod(full) === "open";
  if (!open && !(await hasGalleryAccess(galleryId))) throw new Error("Open the gallery first.");
  const ticket = await beginUpload(gallery.studio_id, { id: galleryId }, { ...meta, uploadedBy: "client" });
  return { id: ticket.photoId, pathname: ticket.pathname, token: ticket.token, duplicateOf: ticket.duplicateOf };
}

export async function clientCompleteUploadAction(galleryId: string, photoId: string, url: string) {
  const { completeUpload } = await import("@/lib/photos");
  const gallery = one<{ studio_id: string; allow_client_upload: boolean; status: string }>(await db()`select studio_id, allow_client_upload, status from galleries where id = ${galleryId}`);
  if (!gallery || gallery.status !== "published" || !gallery.allow_client_upload) throw new Error("Uploads are not open.");
  await completeUpload(gallery.studio_id, photoId, url, null);
}
