"use client";

import { useActionState, useState } from "react";
import type { Gallery } from "@/lib/types";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Dialog, Drawer } from "@/components/ui/dialog";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { saveGallerySettingsAction, sendGalleryEmailAction } from "./gallery-settings-actions";

export function SettingsButton({ gallery, expiresInput }: { gallery: Gallery; expiresInput: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveGallerySettingsAction, initialActionState);
  const downloadValue = gallery.allow_downloads ? gallery.download_size : "off";
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Settings</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Gallery settings">
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="id" value={gallery.id} />
          <FormMessage state={state} />
          <Field label="Title" htmlFor="gs-title" error={state.fields?.title}><Input id="gs-title" name="title" defaultValue={gallery.title} required /></Field>
          <Field label="Welcome message" htmlFor="gs-welcome" hint="Shown at the top of the gallery."><Textarea id="gs-welcome" name="welcome_message" rows={2} defaultValue={gallery.welcome_message ?? ""} /></Field>
          <Field label="Sort photos by" htmlFor="gs-sort">
            <Select id="gs-sort" name="sort_mode" defaultValue={gallery.sort_mode}>
              <option value="manual">Manual order</option>
              <option value="filename">Filename</option>
              <option value="captured">Capture time</option>
            </Select>
          </Field>
          <Field label="Downloads" htmlFor="gs-dl">
            <Select id="gs-dl" name="download_size" defaultValue={downloadValue}>
              <option value="off">Off</option>
              <option value="web">Web size</option>
              <option value="full">Full size</option>
              <option value="both">Both sizes</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pay_gated" defaultChecked={gallery.pay_gated} className="h-4 w-4" /> Lock downloads until the balance is paid</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allow_comments" defaultChecked={gallery.allow_comments} className="h-4 w-4" /> Let clients favorite and leave notes</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allow_sharing" defaultChecked={gallery.allow_sharing} className="h-4 w-4" /> Allow sharing the link</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="watermark" defaultChecked={gallery.watermark} className="h-4 w-4" /> Watermark previews (new uploads)</label>
          <Field label="Expires on" htmlFor="gs-exp" hint="Optional. The gallery goes offline after this date."><Input id="gs-exp" name="expires_at" type="date" defaultValue={expiresInput} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password" htmlFor="gs-pw" hint={gallery.password_hash ? "Set. Type to change." : "Optional."}><Input id="gs-pw" name="password" type="text" placeholder={gallery.password_hash ? "••••••" : ""} /></Field>
            <Field label="Download PIN" htmlFor="gs-pin" hint={gallery.download_pin_hash ? "Set. Type to change." : "Optional."}><Input id="gs-pin" name="download_pin" type="text" /></Field>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {gallery.password_hash ? <label className="flex items-center gap-1"><input type="checkbox" name="clear_password" /> Remove password</label> : null}
            {gallery.download_pin_hash ? <label className="flex items-center gap-1"><input type="checkbox" name="clear_pin" /> Remove PIN</label> : null}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
            <SubmitButton>Save settings</SubmitButton>
          </div>
        </form>
      </Drawer>
    </>
  );
}

export function SendGalleryButton({ galleryId, clientEmail, kind }: { galleryId: string; clientEmail: string; kind: "proof" | "final" }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(sendGalleryEmailAction, initialActionState);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Send to client</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Send gallery">
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="id" value={galleryId} />
          <FormMessage state={state} />
          <p className="text-sm text-ink-2">Sends the {kind === "final" ? "finals-ready" : "proofs-ready"} email from your studio, with the link and access code filled in.</p>
          <Field label="To" htmlFor="sg-to"><Input id="sg-to" name="to" type="email" defaultValue={clientEmail} required /></Field>
          <Field label="Subject" htmlFor="sg-subject" hint="Leave blank to use your template."><Input id="sg-subject" name="subject" /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pendingText="Sending…">Send email</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
