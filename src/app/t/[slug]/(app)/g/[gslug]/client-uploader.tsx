"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Uploader, type UploadTicket } from "@/components/ui/uploader";
import { clientBeginUploadAction, clientCompleteUploadAction } from "./actions";

/** Lets the client add their own photos to a gallery when the studio turned it on (plan 13.13). */
export function ClientUploader({ galleryId }: { galleryId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-[var(--site-line)] px-3 py-1 text-sm">Add your own photos</button>;
  }
  return (
    <div className="mt-4">
      <Uploader
        begin={async (file, sha256) => {
          const t = await clientBeginUploadAction(galleryId, { filename: file.name, size: file.size, contentType: file.type || "image/jpeg", sha256 });
          return t as UploadTicket;
        }}
        complete={async (ticket, url) => { await clientCompleteUploadAction(galleryId, ticket.id, url); }}
        onAllDone={() => router.refresh()}
        hint="Your photos will be added to this gallery for the photographer."
      />
    </div>
  );
}
