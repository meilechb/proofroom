"use client";

import { useRouter } from "next/navigation";
import { Uploader, type UploadTicket } from "@/components/ui/uploader";
import { beginUploadAction, completeUploadAction } from "./photo-actions";

/** Adapts the shared Uploader to this gallery's server actions (plan 12.11, 12.12). */
export function GalleryUploader({ galleryId }: { galleryId: string }) {
  const router = useRouter();
  return (
    <Uploader
      begin={async (file, sha256) => {
        const t = await beginUploadAction(galleryId, { filename: file.name, size: file.size, contentType: file.type || "image/jpeg", sha256 });
        return t as UploadTicket;
      }}
      complete={async (ticket, url) => {
        await completeUploadAction(galleryId, ticket.id, url);
      }}
      onAllDone={() => router.refresh()}
    />
  );
}
