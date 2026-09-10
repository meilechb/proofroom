"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWritableStudio, requireEntitledStudio } from "@/lib/auth";
import { createImport, registerFile, scanImport, startImport, cancelImport, getImport, importClientsFromCsv } from "@/lib/imports";
import { clientUploadToken, safeFilename } from "@/lib/storage";
import { IMPORT_SOURCES, type ImportSource } from "@/lib/imports/sources";
import { str, type ActionState } from "@/lib/action-state";

const MAX_ZIP_BYTES = 5 * 1024 * 1024 * 1024;

/** Start a new import of the chosen source and open its wizard (plan 21.1). */
export async function newImportAction(formData: FormData) {
  const { studio, user } = await requireEntitledStudio("imports");
  const source = str(formData, "source", 20) as ImportSource;
  if (!(source in IMPORT_SOURCES)) return;
  const imp = await createImport(studio.id, source, user.id);
  if (!imp) return;
  redirect(`/studio/import/${imp.id}`);
}

type Meta = { filename: string; size: number; contentType: string };

/** Uploader.begin: a direct-to-Blob token for one zip (plan 21.1). */
export async function beginImportUploadAction(importId: string, meta: Meta) {
  const { studio } = await requireWritableStudio();
  const imp = await getImport(studio.id, importId);
  if (!imp || imp.status !== "uploading") throw new Error("This import is not accepting files.");
  const pathname = `imports/${importId}/${safeFilename(meta.filename, "upload.zip")}`;
  const token = await clientUploadToken({ store: "galleries", pathname, maximumSizeInBytes: MAX_ZIP_BYTES, allowedContentTypes: ["application/zip", "application/x-zip-compressed", "application/octet-stream", "multipart/x-zip"] });
  return { id: pathname, pathname, token };
}

/** Uploader.complete: record the uploaded zip against the import (plan 21.1). */
export async function completeImportUploadAction(importId: string, url: string, filename: string, size: number) {
  const { studio } = await requireWritableStudio();
  const imp = await getImport(studio.id, importId);
  if (!imp || imp.status !== "uploading") throw new Error("This import is not accepting files.");
  await registerFile(importId, url, filename, Math.max(0, Math.round(size)));
}

/** Scan the uploaded zips and move to the review step (plan 21.2). */
export async function scanImportAction(importId: string): Promise<ActionState> {
  const { studio } = await requireWritableStudio();
  const imp = await getImport(studio.id, importId);
  if (!imp || imp.status !== "uploading") return { error: "This import cannot be scanned." };
  if (imp.file_count === 0) return { error: "Upload at least one zip first." };
  try {
    await scanImport(studio.id, importId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not scan the files." };
  }
  revalidatePath(`/studio/import/${importId}`);
  return { ok: true, message: "Scanned." };
}

type EditedGallery = { folder: string; fileId: string; title: string; clientId: string | null; clientEmail?: string; clientName?: string; kind: "proof" | "final"; include: boolean };

/** Store the studio's edits and start processing (plan 21.2, 21.3). */
export async function startImportAction(importId: string, edited: EditedGallery[]): Promise<ActionState> {
  const { studio } = await requireWritableStudio();
  try {
    await startImport(studio.id, importId, edited);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not start the import." };
  }
  revalidatePath(`/studio/import/${importId}`);
  return { ok: true, message: "Import started. This runs in the background." };
}

export async function cancelImportAction(formData: FormData) {
  const { studio } = await requireWritableStudio();
  const id = str(formData, "id", 64);
  await cancelImport(studio.id, id);
  redirect("/studio/import");
}

/** CSV contacts import: parse the text the browser read and create clients (plan 21.2). */
export async function importCsvTextAction(importId: string, text: string): Promise<ActionState> {
  const { studio } = await requireWritableStudio();
  const imp = await getImport(studio.id, importId);
  if (!imp) return { error: "Import not found." };
  if (typeof text !== "string" || text.length === 0) return { error: "That file was empty." };
  if (text.length > 8 * 1024 * 1024) return { error: "That CSV is too large. Split it into smaller files." };
  const result = await importClientsFromCsv(studio.id, imp.source, text);
  const { db } = await import("@/lib/db");
  await db()`update imports set status = 'done', finished_at = now(), gallery_count = 0, photo_count = 0, processed_count = ${result.created} where id = ${importId} and studio_id = ${studio.id}`;
  revalidatePath(`/studio/import/${importId}`);
  return { ok: true, message: `Imported ${result.created} new client${result.created === 1 ? "" : "s"}${result.existing ? `, matched ${result.existing} existing` : ""}${result.skipped ? `, skipped ${result.skipped}` : ""}.` };
}
