"use client";

import { useActionState, useState } from "react";
import type { InquiryRow } from "@/lib/inbox";
import { renderTemplate } from "@/lib/email-templates";
import { formatDate } from "@/lib/types";
import { Button, Field, Input, Textarea, Badge } from "@/components/ui";
import { Drawer } from "@/components/ui/dialog";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { convertToClientAction, replyInquiryAction } from "./actions";

/** Opens an inquiry in a drawer with a prefilled reply composer (plan 10.2, 10.3). */
export function InquiryPanel({ inquiry, template }: { inquiry: InquiryRow; template: { subject: string; body: string } }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(replyInquiryAction, initialActionState);
  const bodyDefault = renderTemplate(template.body, { client_name: inquiry.name.split(" ")[0] || inquiry.name, message: inquiry.message ?? "" });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-left font-medium hover:underline">{inquiry.name}</button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Inquiry">
        <div className="space-y-4">
          <div>
            <p className="font-medium">{inquiry.name}</p>
            <p className="text-sm text-ink-2">{inquiry.email}{inquiry.phone ? ` · ${inquiry.phone}` : ""}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>{formatDate(inquiry.created_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              {inquiry.source ? <Badge>{inquiry.source}</Badge> : null}
              {inquiry.has_booking ? <Badge tone="brand">Booking request</Badge> : null}
            </p>
          </div>
          {inquiry.has_booking ? (
            <div className="rounded-lg bg-surface-2 p-3 text-sm">
              {inquiry.package_name ? <p><span className="text-muted">Package:</span> {inquiry.package_name}</p> : null}
              {inquiry.people_count ? <p><span className="text-muted">People:</span> {inquiry.people_count}</p> : null}
            </div>
          ) : null}
          {inquiry.message ? <blockquote className="rounded-lg border border-line bg-surface px-4 py-3 text-sm whitespace-pre-wrap">{inquiry.message}</blockquote> : <p className="text-sm text-muted">No message.</p>}

          <div className="flex flex-wrap gap-2">
            <form action={convertToClientAction}>
              <input type="hidden" name="id" value={inquiry.id} />
              <Button type="submit" variant="secondary" size="sm">Convert to client</Button>
            </form>
          </div>

          <form action={action} className="space-y-3 border-t border-line pt-4">
            <p className="text-sm font-medium">Reply by email</p>
            <input type="hidden" name="id" value={inquiry.id} />
            <input type="hidden" name="to" value={inquiry.email} />
            <FormMessage state={state} />
            <Field label="Subject" htmlFor="r-subject" error={state.fields?.subject}>
              <Input id="r-subject" name="subject" defaultValue={template.subject} required />
            </Field>
            <Field label="Message" htmlFor="r-body" error={state.fields?.body}>
              <Textarea id="r-body" name="body" rows={8} defaultValue={bodyDefault} required />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
              <SubmitButton pendingText="Sending…">Send reply</SubmitButton>
            </div>
          </form>
        </div>
      </Drawer>
    </>
  );
}
