import "server-only";

import { Unzip, UnzipInflate } from "fflate";
import { db, one, rows } from "@/lib/db";
import { downloadBlob, PREVIEW_MAX_EDGE, THUMB_MAX_EDGE, captureTime, makeWebVersion, putJpeg, sha256 } from "@/lib/images";
import { galleryPath, safeFilename } from "@/lib/storage";
import { put } from "@vercel/blob";
import { blobToken } from "@/lib/storage";
import { addBytes } from "@/lib/usage";
import { createGallery } from "@/lib/galleries";
import { createClient } from "@/lib/clients";
import { isImageEntry, proposeGalleries, type ImportSource, type ProposedGallery, type ZipEntryInfo } from "@/lib/imports/sources";
import { log } from "@/lib/logger";

/**
 * Imports from other gallery tools (plan 3.87). Zips are uploaded to the
 * private store, scanned by streaming (no zip is held in memory), mapped to
 * galleries, then processed in chunks by the frequent cron so a 5 GB import
 * survives serverless time limits. Photos are recorded like normal uploads.
 */

export type ImportRow = { id: string; studio_id: string; source: ImportSource; status: string; mapping: ImportMapping; file_count: number; gallery_count: number; photo_count: number; processed_count: number; log: string[]; started_at: string | null; finished_at: string | null; created_at: string };
export type ImportFile = { id: string; import_id: string; url: string; filename: string; size_bytes: number; status: string; error: string | null };
export type MappedGallery = { fileId: string; folder: string; title: string; clientId: string | null; clientEmail?: string; clientName?: string; kind: "proof" | "final"; include: boolean; galleryId?: string | null; files: string[]; done?: string[] };
export type ImportMapping = { galleries: MappedGallery[] };

export const CHUNK_PHOTOS = 20;

export async function createImport(studioId: string, source: ImportSource, userId: string | null) {
  return one<ImportRow>(await db()`insert into imports (studio_id, source, created_by) values (${studioId}, ${source}, ${userId}) returning *`);
}

export async function getImport(studioId: string, id: string) {
  return one<ImportRow>(await db()`select * from imports where id = ${id} and studio_id = ${studioId}`);
}

export async function registerFile(importId: string, url: string, filename: string, sizeBytes: number) {
  const file = one<ImportFile>(await db()`insert into import_files (import_id, url, filename, size_bytes) values (${importId}, ${url}, ${safeFilename(filename, "upload.zip")}, ${sizeBytes}) returning *`);
  await db()`update imports set file_count = file_count + 1 where id = ${importId}`;
  return file;
}

/** Streams a zip from Blob and lists entries without decompressing anything (plan 3.87.3). */
export async function scanZip(url: string): Promise<ZipEntryInfo[]> {
  const { get } = await import("@vercel/blob");
  const result = await get(url, { access: "private", token: blobToken("galleries"), useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error("Zip not found in storage");
  const entries: ZipEntryInfo[] = [];
  const unzipper = new Unzip((file) => {
    if (isImageEntry(file.name)) entries.push({ name: file.name, size: file.originalSize ?? 0 });
    // Not started: the central listing is all we need here.
  });
  unzipper.register(UnzipInflate);
  const reader = result.stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    unzipper.push(value, false);
  }
  unzipper.push(new Uint8Array(0), true);
  return entries;
}

/** Scans every file and proposes galleries; moves the import to review (plan 3.87.4). */
export async function scanImport(studioId: string, importId: string) {
  const imp = await getImport(studioId, importId);
  if (!imp) throw new Error("Not found");
  await db()`update imports set status = 'scanning' where id = ${importId}`;
  const files = rows<ImportFile>(await db()`select * from import_files where import_id = ${importId} order by created_at`);
  const mapping: ImportMapping = { galleries: [] };
  let photos = 0;
  for (const f of files) {
    try {
      const entries = await scanZip(f.url);
      const proposed: ProposedGallery[] = proposeGalleries(entries, f.filename);
      for (const p of proposed) {
        mapping.galleries.push({ fileId: f.id, folder: p.folder, title: p.title, clientId: null, kind: "proof", include: true, files: p.files });
        photos += p.files.length;
      }
      await db()`update import_files set status = 'scanned' where id = ${f.id}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db()`update import_files set status = 'failed', error = ${message} where id = ${f.id}`;
      await appendLog(importId, `Could not read ${f.filename}: ${message}`);
    }
  }
  await db()`update imports set status = 'review', mapping = ${JSON.stringify(mapping)}::jsonb, gallery_count = ${mapping.galleries.length}, photo_count = ${photos} where id = ${importId}`;
  return mapping;
}

/** The studio edited titles, clients and kinds; store and start (plan 3.87.5 start). */
export async function startImport(studioId: string, importId: string, edited: { folder: string; fileId: string; title: string; clientId: string | null; clientEmail?: string; clientName?: string; kind: "proof" | "final"; include: boolean }[]) {
  const imp = await getImport(studioId, importId);
  if (!imp || imp.status !== "review") throw new Error("This import is not ready to start.");
  const galleries = imp.mapping.galleries.map((g) => {
    const e = edited.find((x) => x.fileId === g.fileId && x.folder === g.folder);
    return e ? { ...g, title: e.title, clientId: e.clientId, clientEmail: e.clientEmail, clientName: e.clientName, kind: e.kind, include: e.include } : g;
  });
  await db()`update imports set status = 'running', mapping = ${JSON.stringify({ galleries })}::jsonb, started_at = now(), gallery_count = ${galleries.filter((g) => g.include).length}, photo_count = ${galleries.filter((g) => g.include).reduce((n, g) => n + g.files.length, 0)} where id = ${importId}`;
}

/**
 * Processes up to CHUNK_PHOTOS photos, creating galleries and clients on first
 * touch. Idempotent: done files are recorded in the mapping (plan 3.87.5).
 */
export async function processChunk(studioId: string, importId: string, chunk = CHUNK_PHOTOS) {
  const imp = await getImport(studioId, importId);
  if (!imp || imp.status !== "running") return { done: true, processed: 0 };
  const mapping = imp.mapping;
  let processed = 0;
  for (const g of mapping.galleries) {
    if (!g.include) continue;
    const done = new Set(g.done ?? []);
    const pending = g.files.filter((f) => !done.has(f));
    if (pending.length === 0) continue;
    if (!g.galleryId) {
      let clientId = g.clientId;
      if (!clientId) {
        const email = g.clientEmail || `import+${Date.now().toString(36)}@example.invalid`;
        clientId = (await createClient(studioId, { name: g.clientName || g.title, email, source: `import:${imp.source}` })).client.id;
      }
      const gallery = await createGallery(studioId, { clientId, kind: g.kind, title: g.title, source: "web" });
      g.galleryId = gallery.id;
      g.clientId = clientId;
    }
    const file = one<ImportFile>(await db()`select * from import_files where id = ${g.fileId}`);
    if (!file) continue;
    const wanted = new Set(pending.slice(0, chunk - processed));
    const extracted = await extractEntries(file.url, wanted);
    for (const [name, data] of extracted) {
      try {
        await storeImportedPhoto(studioId, g.galleryId!, name, data);
        done.add(name);
        processed++;
      } catch (error) {
        await appendLog(importId, `Skipped ${name}: ${error instanceof Error ? error.message : String(error)}`);
        done.add(name);
      }
    }
    g.done = [...done];
    if (processed >= chunk) break;
  }
  const remaining = mapping.galleries.filter((g) => g.include).reduce((n, g) => n + g.files.filter((f) => !(g.done ?? []).includes(f)).length, 0);
  await db()`update imports set mapping = ${JSON.stringify(mapping)}::jsonb, processed_count = processed_count + ${processed} where id = ${importId}`;
  if (remaining === 0) await finishImport(importId);
  return { done: remaining === 0, processed };
}

/** Streams the zip once and collects only the wanted entries into memory. */
async function extractEntries(url: string, wanted: Set<string>): Promise<Map<string, Uint8Array>> {
  const { get } = await import("@vercel/blob");
  const result = await get(url, { access: "private", token: blobToken("galleries"), useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error("Zip not found in storage");
  const out = new Map<string, Uint8Array>();
  const chunks = new Map<string, Uint8Array[]>();
  const unzipper = new Unzip((file) => {
    if (!wanted.has(file.name)) return;
    chunks.set(file.name, []);
    file.ondata = (err, data, final) => {
      if (err) return;
      chunks.get(file.name)!.push(data);
      if (final) {
        const parts = chunks.get(file.name)!;
        const total = parts.reduce((n, p) => n + p.length, 0);
        const merged = new Uint8Array(total);
        let off = 0;
        for (const p of parts) {
          merged.set(p, off);
          off += p.length;
        }
        out.set(file.name, merged);
        chunks.delete(file.name);
      }
    };
    file.start();
  });
  unzipper.register(UnzipInflate);
  const reader = result.stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    unzipper.push(value, false);
  }
  unzipper.push(new Uint8Array(0), true);
  return out;
}

async function storeImportedPhoto(studioId: string, galleryId: string, entryName: string, data: Uint8Array) {
  const original = Buffer.from(data);
  const filename = safeFilename(entryName.split("/").pop() ?? "photo.jpg", "photo.jpg");
  const hash = sha256(original);
  const dup = await db()`select 1 from photos where gallery_id = ${galleryId} and sha256 = ${hash} and deleted_at is null limit 1`;
  if (dup.length > 0) return;
  const [preview, thumb, captured] = await Promise.all([makeWebVersion(original, PREVIEW_MAX_EDGE), makeWebVersion(original, THUMB_MAX_EDGE, 80), captureTime(original)]);
  const base = galleryPath(studioId, galleryId, `${Date.now()}-${filename}`);
  const originalBlob = await put(base, original, { access: "private", token: blobToken("galleries"), addRandomSuffix: true, contentType: "image/jpeg" });
  const stem = originalBlob.pathname.replace(/\.[a-z0-9]+$/i, "");
  const previewBlob = await putJpeg("galleries", `${stem}-preview.jpg`, preview.buffer);
  const thumbBlob = await putJpeg("galleries", `${stem}-thumb.jpg`, thumb.buffer);
  const total = original.length + preview.buffer.length + thumb.buffer.length;
  const next = one<{ n: number }>(await db()`select coalesce(max(sort_order), 0) + 1 as n from photos where gallery_id = ${galleryId}`);
  await db()`
    insert into photos (studio_id, gallery_id, original_url, preview_url, thumb_url, filename, width, height, size_bytes, sort_order, sha256, uploaded_by, captured_at)
    values (${studioId}, ${galleryId}, ${originalBlob.url}, ${previewBlob.url}, ${thumbBlob.url}, ${filename}, ${preview.width}, ${preview.height}, ${total}, ${next?.n ?? 1}, ${hash}, 'studio', ${captured ? captured.toISOString() : null})`;
  await addBytes(studioId, total);
}

async function appendLog(importId: string, line: string) {
  await db()`update imports set log = log || ${JSON.stringify([`${new Date().toISOString()} ${line}`])}::jsonb where id = ${importId}`;
}

export async function finishImport(importId: string) {
  await db()`update imports set status = 'done', finished_at = now() where id = ${importId}`;
  log.info("import.finished", { import: importId });
}

export async function cancelImport(studioId: string, importId: string) {
  await db()`update imports set status = 'cancelled', finished_at = now() where id = ${importId} and studio_id = ${studioId} and status in ('uploading', 'scanning', 'review', 'running')`;
}

/** Cron (frequent): advance every running import by one chunk (plan 21.3). */
export async function advanceRunningImports() {
  const running = rows<{ id: string; studio_id: string }>(await db()`select id, studio_id from imports where status = 'running' order by started_at limit 5`);
  let total = 0;
  for (const r of running) {
    try {
      total += (await processChunk(r.studio_id, r.id)).processed;
    } catch (error) {
      await appendLog(r.id, `Chunk failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return total;
}

/** Cron (daily): delete zips of finished imports older than a day; keep the log 30 days. */
export async function cleanupImports() {
  const { del } = await import("@vercel/blob");
  const old = rows<ImportFile>(await db()`select f.* from import_files f join imports i on i.id = f.import_id where i.status in ('done', 'cancelled', 'failed') and i.finished_at < now() - interval '1 day'`);
  if (old.length > 0) {
    await del(old.map((f) => f.url), { token: blobToken("galleries") }).catch(() => undefined);
    await db()`delete from import_files where id = any(${old.map((f) => f.id)}::uuid[])`;
  }
  await db()`delete from imports where status in ('done', 'cancelled', 'failed') and finished_at < now() - interval '30 days'`;
  return old.length;
}
