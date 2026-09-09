"use client";

import { useCallback, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

/**
 * Direct-to-Blob uploader (plan 4.22). The page supplies `begin`, which asks the
 * server for a client token per file, and `complete`, which tells the server the
 * bytes landed. Four files upload at once; failures retry up to three times.
 */
export type UploadTicket = { id: string; pathname: string; token: string; duplicateOf?: string | null };
export type UploadItem = { key: string; file: File; status: "queued" | "uploading" | "processing" | "done" | "failed" | "duplicate"; progress: number; error?: string; attempts: number };

export function Uploader({ accept = "image/jpeg,image/png,image/webp,image/tiff,image/heic", maxBytes = 200 * 1024 * 1024, begin, complete, onAllDone, hint }: {
  accept?: string;
  maxBytes?: number;
  begin: (file: File, sha256: string | null) => Promise<UploadTicket>;
  complete: (ticket: UploadTicket, url: string) => Promise<void>;
  onAllDone?: (doneCount: number) => void;
  hint?: string;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const cancelled = useRef(false);
  const running = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<UploadItem>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const uploadOne = useCallback(async (item: UploadItem) => {
    update(item.key, { status: "uploading", progress: 0, error: undefined });
    try {
      const hash = await hashFile(item.file);
      const ticket = await begin(item.file, hash);
      if (ticket.duplicateOf) {
        update(item.key, { status: "duplicate", progress: 100 });
        return;
      }
      const { put } = await import("@vercel/blob/client");
      const blob = await put(ticket.pathname, item.file, {
        access: "private",
        token: ticket.token,
        contentType: item.file.type || "application/octet-stream",
        onUploadProgress: (e) => update(item.key, { progress: e.percentage }),
      });
      update(item.key, { status: "processing", progress: 100 });
      await complete(ticket, blob.url);
      update(item.key, { status: "done" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      update(item.key, { status: "failed", error: message, attempts: item.attempts + 1 });
    }
  }, [begin, complete]);

  const run = useCallback(async (queue: UploadItem[]) => {
    if (running.current) return;
    running.current = true;
    cancelled.current = false;
    const pending = [...queue];
    let done = 0;
    const worker = async () => {
      while (pending.length && !cancelled.current) {
        const next = pending.shift()!;
        await uploadOne(next);
        done++;
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    running.current = false;
    onAllDone?.(done);
  }, [uploadOne, onAllDone]);

  const addFiles = (files: FileList | File[]) => {
    const fresh: UploadItem[] = [];
    for (const file of Array.from(files)) {
      if (file.size > maxBytes) {
        fresh.push({ key: `${file.name}-${file.size}-${file.lastModified}`, file, status: "failed", progress: 0, error: `Over ${Math.round(maxBytes / 1024 / 1024)} MB`, attempts: 3 });
        continue;
      }
      fresh.push({ key: `${file.name}-${file.size}-${file.lastModified}`, file, status: "queued", progress: 0, attempts: 0 });
    }
    setItems((list) => [...list, ...fresh.filter((f) => !list.some((l) => l.key === f.key))]);
    void run(fresh.filter((f) => f.status === "queued"));
  };

  const retryFailed = () => {
    const failed = items.filter((i) => i.status === "failed" && i.attempts < 3);
    setItems((list) => list.map((i) => (failed.some((f) => f.key === i.key) ? { ...i, status: "queued" } : i)));
    void run(failed);
  };

  const cancelAll = () => {
    cancelled.current = true;
    setItems((list) => list.map((i) => (i.status === "queued" ? { ...i, status: "failed", error: "Cancelled", attempts: 3 } : i)));
  };

  const counts = { done: items.filter((i) => i.status === "done").length, failed: items.filter((i) => i.status === "failed").length, active: items.filter((i) => i.status === "uploading" || i.status === "processing" || i.status === "queued").length };
  const overall = items.length ? Math.round(items.reduce((n, i) => n + (i.status === "done" || i.status === "duplicate" ? 100 : i.progress), 0) / items.length) : 0;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        className={cx("card card-pad text-center border-dashed cursor-pointer select-none", dragging && "border-accent bg-accent/5")}
      >
        <Icon.Upload className="mx-auto text-muted" size={24} />
        <p className="mt-2 text-sm font-medium">Drop photos here or click to choose</p>
        <p className="hint">{hint ?? "JPEG, PNG, WebP, TIFF or HEIC, up to 200 MB each. Many at once is fine."}</p>
        <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
      </div>
      {items.length > 0 ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span>{counts.done} of {items.length} uploaded{counts.failed ? `, ${counts.failed} failed` : ""}</span>
            <div className="flex gap-2">
              {counts.failed ? <button type="button" className="btn-secondary btn-sm" onClick={retryFailed}>Retry failed</button> : null}
              {counts.active ? <button type="button" className="btn-ghost btn-sm" onClick={cancelAll}>Cancel remaining</button> : null}
            </div>
          </div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={overall} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-brand" style={{ width: `${overall}%` }} /></div>
          <ul className="mt-3 max-h-56 overflow-y-auto divide-y divide-line text-sm">
            {items.map((i) => (
              <li key={i.key} className="flex items-center gap-3 py-1.5">
                <span className="flex-1 truncate">{i.file.name}</span>
                <span className={cx("text-xs", i.status === "failed" ? "text-danger" : i.status === "done" ? "text-success" : "text-muted")}>
                  {i.status === "uploading" ? `${i.progress}%` : i.status === "processing" ? "Processing" : i.status === "duplicate" ? "Already in gallery" : i.status === "failed" ? i.error : i.status === "done" ? "Done" : "Waiting"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

async function hashFile(file: File): Promise<string | null> {
  if (!("crypto" in window) || !window.crypto.subtle || file.size > 60 * 1024 * 1024) return null;
  try {
    const digest = await window.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}
