"use client";

import { useState } from "react";
import { resendVerificationAction } from "@/app/(auth)/actions";

export function ResendVerification() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        type="button"
        className="underline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await resendVerificationAction();
          setMsg(res.message ?? res.error ?? null);
          setBusy(false);
        }}
      >
        {busy ? "Sending…" : "Resend the link"}
      </button>
      {msg ? <span className="ml-2">{msg}</span> : null}
    </>
  );
}
