"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { importCsvTextAction } from "../actions";

/** Reads a contacts CSV in the browser and imports it as clients (plan 21.2). */
export function CsvUploader({ importId }: { importId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setMsg(null);
    start(async () => {
      const text = await file.text();
      const res = await importCsvTextAction(importId, text);
      if (res.ok) { setMsg({ ok: true, text: res.message ?? "Imported." }); router.refresh(); }
      else setMsg({ ok: false, text: res.error ?? "Could not import that file." });
    });
  };

  return (
    <div className="space-y-3">
      <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <Button onClick={() => input.current?.click()} disabled={pending}>{pending ? "Importing…" : "Choose CSV"}</Button>
      {msg ? <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p> : null}
    </div>
  );
}
