"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Uploader, type UploadTicket } from "@/components/ui/uploader";
import { Button } from "@/components/ui";
import { beginImportUploadAction, completeImportUploadAction, scanImportAction } from "../actions";

/** Uploads zip exports to Blob, then scans them into proposed galleries (plan 21.1, 21.2). */
export function ImportUploader({ importId, fileCount }: { importId: string; fileCount: number }) {
  const router = useRouter();
  const meta = useRef(new Map<string, { filename: string; size: number }>());
  const [uploaded, setUploaded] = useState(fileCount);
  const [scanning, startScan] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const scan = () => {
    setError(null);
    startScan(async () => {
      const res = await scanImportAction(importId);
      if (res.ok) router.refresh();
      else setError(res.error ?? "Could not scan the files.");
    });
  };

  return (
    <div className="space-y-4">
      <Uploader
        accept=".zip,application/zip,application/x-zip-compressed,application/octet-stream"
        maxBytes={5 * 1024 * 1024 * 1024}
        hint="Zip files up to 5 GB each. Upload every zip from your export before scanning."
        begin={async (file) => {
          const t = await beginImportUploadAction(importId, { filename: file.name, size: file.size, contentType: file.type || "application/zip" });
          meta.current.set(t.pathname, { filename: file.name, size: file.size });
          return t as UploadTicket;
        }}
        complete={async (ticket, url) => {
          const m = meta.current.get(ticket.pathname);
          await completeImportUploadAction(importId, url, m?.filename ?? "upload.zip", m?.size ?? 0);
          setUploaded((n) => n + 1);
        }}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button onClick={scan} disabled={scanning || uploaded === 0}>{scanning ? "Scanning…" : "Scan files"}</Button>
        {uploaded === 0 ? <span className="text-xs text-muted">Upload at least one zip to continue.</span> : null}
      </div>
    </div>
  );
}
