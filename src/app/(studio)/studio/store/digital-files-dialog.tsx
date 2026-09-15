"use client";

import { useState } from "react";
import type { DigitalFile } from "@/lib/types";
import { DIGITAL_ACCEPT, MAX_DIGITAL_BYTES } from "@/lib/store-shared";
import { formatBytes } from "@/lib/assets-shared";
import { Button } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { Uploader, type UploadTicket } from "@/components/ui/uploader";
import { beginDigitalUploadAction, completeDigitalUploadAction, deleteDigitalFileAction } from "./actions";

/**
 * Manage the files a digital product delivers (S21.3). Uploads go straight to
 * the private galleries store via a one-file token; buyers only ever reach them
 * through a paid download grant.
 */
export function DigitalFilesDialog({ productId, files }: { productId: string; files: DigitalFile[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Files{files.length ? ` (${files.length})` : ""}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Digital files">
        <div className="space-y-4">
          {files.length ? (
            <ul className="divide-y divide-line border-y border-line text-sm">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">{f.filename}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted">{formatBytes(f.size_bytes)}</span>
                    <form action={deleteDigitalFileAction}>
                      <input type="hidden" name="id" value={f.id} />
                      <button className="text-xs text-danger hover:underline">Remove</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No files yet. Upload the presets, LUTs or e-books buyers will download.</p>
          )}
          <Uploader
            accept={DIGITAL_ACCEPT}
            maxBytes={MAX_DIGITAL_BYTES}
            access="private"
            hint="ZIP, PDF, EPUB, XMP, LUT and similar, up to 500 MB each."
            begin={async (file) => {
              const t = await beginDigitalUploadAction(productId, { filename: file.name, size: file.size, contentType: file.type || "application/octet-stream" });
              return { id: t.id, pathname: t.pathname, token: t.token } satisfies UploadTicket;
            }}
            complete={async (ticket, url) => {
              await completeDigitalUploadAction(ticket.id, url);
            }}
          />
        </div>
      </Dialog>
    </>
  );
}
