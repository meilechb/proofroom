"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Uploader, type UploadTicket } from "@/components/ui/uploader";
import { ASSET_FOLDERS } from "@/lib/assets-shared";
import { beginAssetUploadAction, completeAssetUploadAction } from "./actions";

/** Adapts the shared Uploader to the public assets store (plan 15.1.1, 15.4). */
export function AssetsUploader() {
  const router = useRouter();
  const [folder, setFolder] = useState("");
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted">Add to folder</span>
        <select value={folder} onChange={(e) => setFolder(e.target.value)} className="h-9 rounded-lg border border-line-2 bg-surface px-2 text-sm capitalize">
          <option value="">None</option>
          {ASSET_FOLDERS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </label>
      <Uploader
        access="public"
        begin={async (file) => {
          const t = await beginAssetUploadAction({ filename: file.name, size: file.size, contentType: file.type || "image/jpeg" }, folder || undefined);
          return t as UploadTicket;
        }}
        complete={async (ticket, url) => {
          await completeAssetUploadAction(ticket.id, url);
        }}
        onAllDone={() => router.refresh()}
        hint="JPEG, PNG, WebP, TIFF or HEIC. These are public and used on your website, portfolio and emails."
      />
    </div>
  );
}
