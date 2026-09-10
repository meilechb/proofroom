"use client";

import { useActionState, useState } from "react";
import type { Order } from "@/lib/types";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { MoneyField, DateTimeField } from "@/components/ui/fields";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { CopyButton } from "@/components/forms/copy-button";
import { initialActionState } from "@/lib/action-state";
import { cancelSessionAction, editSessionAction, manualPaymentAction, markNoShowAction } from "./session-actions";

export function EditSessionButton({ order, timezone }: { order: Order; timezone: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(editSessionAction, initialActionState);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Edit</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Edit session #${order.order_number}`}>
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="id" value={order.id} />
          <FormMessage state={state} />
          <Field label="Title" htmlFor="es-title" error={state.fields?.title}><Input id="es-title" name="title" defaultValue={order.title} required /></Field>
          <DateTimeField name="scheduledAt" label="Date and time" timeZone={timezone} defaultValue={order.scheduled_at} hint="Leave blank to unschedule." />
          <Field label="Location" htmlFor="es-loc"><Input id="es-loc" name="location" defaultValue={order.location ?? ""} /></Field>
          <MoneyField name="discount" label="Discount" defaultCents={order.discount_cents} hint="Comes off the total." />
          <Field label="Notes" htmlFor="es-notes"><Textarea id="es-notes" name="notes" rows={2} defaultValue={order.notes ?? ""} /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton>Save</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function ManualPaymentButton({ orderId, currency }: { orderId: string; currency: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(manualPaymentAction, initialActionState);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Record a payment</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Record a payment">
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="id" value={orderId} />
          <FormMessage state={state} />
          <p className="text-sm text-ink-2">For cash, check or a bank transfer you took outside the app.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField name="amount" label="Amount" defaultCents={0} currency={currency.toUpperCase()} />
            <Field label="Method" htmlFor="mp-method">
              <Select id="mp-method" name="method" defaultValue="cash">
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="transfer">Bank transfer</option>
                <option value="other">Other</option>
              </Select>
            </Field>
          </div>
          <Field label="Note" htmlFor="mp-note"><Input id="mp-note" name="note" placeholder="Optional reference" /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton>Record payment</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function CancelSessionButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Cancel session</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Cancel this session?">
        <form action={cancelSessionAction} className="space-y-4">
          <input type="hidden" name="id" value={orderId} />
          <p className="text-sm text-ink-2">The session is marked cancelled. Its payment history is kept. This does not refund anything.</p>
          <Field label="Reason" htmlFor="cs-reason" hint="Optional; shown on the client timeline."><Input id="cs-reason" name="reason" /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Keep it</Button>
            <Button type="submit" variant="danger">Cancel session</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function NoShowButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Mark no-show</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Mark as a no-show?">
        <form action={markNoShowAction} className="space-y-4">
          <input type="hidden" name="id" value={orderId} />
          <p className="text-sm text-ink-2">The booking is recorded as a no-show and noted on the client&apos;s timeline. The session and its payments are kept.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Back</Button>
            <Button type="submit" variant="danger">Mark no-show</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function PayLink({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-md bg-surface-2 px-3 py-2 text-xs font-mono">{url}</code>
      <CopyButton value={url} label="Copy link" />
    </div>
  );
}
