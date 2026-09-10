"use server";

import { revalidatePath } from "next/cache";
import { requireWritableStudio } from "@/lib/auth";
import { getGallery, updateGallerySettings } from "@/lib/galleries";
import { beginUpload, completeUpload, renamePhoto, reorderPhotos, softDeletePhotos } from "@/lib/photos";
import { db } from "@/lib/db";
import { str, type ActionState } from "@/lib/action-state";

type Meta = { filename: string; size: number; contentType: string; sha256: string | null };

/** Uploader.begin: reserve a photo row and a direct-upload token (plan 12.11). */
export async function beginUploadAction(galleryId: string, meta: Meta) {
  const { studio } = await requireWritableStudio();
  const gallery = await getGallery(studio.id, galleryId);
  if (!gallery) throw new Error("Gallery not found.");
  const ticket = await beginUpload(studio.id, { id: gallery.id }, meta);
  return { id: ticket.photoId, pathname: ticket.pathname, token: ticket.token, duplicateOf: ticket.duplicateOf };
}

/** Uploader.complete: generate variants once the bytes have landed (plan 12.12). */
export async function completeUploadAction(galleryId: string, photoId: string, url: string) {
  const { studio } = await requireWritableStudio();
  const gallery = await getGallery(studio.id, galleryId);
  if (!gallery) throw new Error("Gallery not found.");
  await completeUpload(studio.id, photoId, url, gallery.watermark ? studio.name : null);
}

export async function deletePhotosAction(formData: FormData) {
  const { studio } = await requireWritableStudio();
  const galleryId = str(formData, "galleryId", 64);
  const ids = str(formData, "ids", 20000).split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length) await softDeletePhotos(studio.id, ids);
  revalidatePath(`/studio/galleries/${galleryId}`);
}

export async function setCoverAction(formData: FormData) {
  const { studio } = await requireWritableStudio();
  const galleryId = str(formData, "galleryId", 64);
  await updateGallerySettings(studio.id, galleryId, { cover_photo_id: str(formData, "photoId", 64) });
  revalidatePath(`/studio/galleries/${galleryId}`);
}

export async function renamePhotoAction(formData: FormData) {
  const { studio } = await requireWritableStudio();
  const name = str(formData, "filename", 200);
  if (name) await renamePhoto(studio.id, str(formData, "photoId", 64), name);
  revalidatePath(`/studio/galleries/${str(formData, "galleryId", 64)}`);
}

export async function reorderPhotosAction(galleryId: string, orderedIds: string[]) {
  const { studio } = await requireWritableStudio();
  await reorderPhotos(studio.id, galleryId, orderedIds);
  revalidatePath(`/studio/galleries/${galleryId}`);
}

export async function resolveNoteAction(formData: FormData) {
  const { studio } = await requireWritableStudio();
  const galleryId = str(formData, "galleryId", 64);
  const noteId = str(formData, "noteId", 64);
  const resolved = str(formData, "resolved", 5) !== "false";
  await db()`update photo_comments set resolved = ${resolved} where id = ${noteId} and studio_id = ${studio.id}`;
  revalidatePath(`/studio/galleries/${galleryId}`);
}
