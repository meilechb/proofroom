"use client";

import { Button } from "@/components/ui";
import { cancelImportAction } from "../actions";

export function CancelImport({ importId }: { importId: string }) {
  return (
    <form action={cancelImportAction} onSubmit={(e) => { if (!confirm("Cancel this import?")) e.preventDefault(); }}>
      <input type="hidden" name="id" value={importId} />
      <Button type="submit" variant="ghost" size="sm">Cancel import</Button>
    </form>
  );
}
