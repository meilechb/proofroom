"use client";

import { useActionState } from "react";
import type { StoreSettings } from "@/lib/store-shared";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { saveStoreSettingsAction } from "../actions";

export function StoreSettingsForm({ settings, stripeReady }: { settings: StoreSettings; stripeReady: boolean }) {
  const [state, action] = useActionState(saveStoreSettingsAction, initialActionState);
  return (
    <form action={action} className="space-y-5 max-w-2xl" noValidate>
      <FormMessage state={state} />
      {!stripeReady ? (
        <Notice tone="warning">
          Connect your Stripe account under <a className="underline" href="/studio/settings/payments">Payments</a> before turning the store on — buyers pay into your own account.
        </Notice>
      ) : null}

      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="h-4 w-4" /> Show the shop on my website</label>

      <Field label="How buyers pay" htmlFor="ss-mode" hint="Card payments go straight into your own Stripe. Choose Manual to arrange payment off-platform.">
        <Select id="ss-mode" name="paymentMode" defaultValue={settings.paymentMode === "marketplace" ? "connected" : settings.paymentMode}>
          <option value="connected">My own Stripe (0% commission)</option>
          <option value="manual">Manual / off-platform</option>
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Download limit" htmlFor="ss-max" hint="How many times a purchased file can be downloaded." error={state.fields?.downloadMaxCount}>
          <Input id="ss-max" name="downloadMaxCount" type="number" min={1} max={100} defaultValue={settings.downloadMaxCount} />
        </Field>
        <Field label="Download window (hours)" htmlFor="ss-win" hint="How long the download link stays valid." error={state.fields?.downloadWindowHours}>
          <Input id="ss-win" name="downloadWindowHours" type="number" min={1} max={8760} defaultValue={settings.downloadWindowHours} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="watermark" defaultChecked={settings.watermark} className="h-4 w-4" /> Watermark previews of for-sale photos</label>
      <Field label="Watermark text" htmlFor="ss-wm" hint="Defaults to your studio name." error={state.fields?.watermarkText}>
        <Input id="ss-wm" name="watermarkText" defaultValue={settings.watermarkText ?? ""} placeholder="Your studio name" />
      </Field>

      <Field label="Delivery & refund policy" htmlFor="ss-policy" hint="Shown to buyers at checkout.">
        <Textarea id="ss-policy" name="deliveryPolicy" rows={3} defaultValue={settings.deliveryPolicy ?? ""} />
      </Field>

      <Field label="Manual payment instructions" htmlFor="ss-mi" hint="Shown when 'Manual / off-platform' is selected.">
        <Textarea id="ss-mi" name="manualInstructions" rows={2} defaultValue={settings.manualInstructions ?? ""} />
      </Field>
      <Field label="Manual payment link" htmlFor="ss-ml" error={state.fields?.manualPaymentLink}>
        <Input id="ss-ml" name="manualPaymentLink" type="url" defaultValue={settings.manualPaymentLink ?? ""} placeholder="https://" />
      </Field>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => history.back()}>Cancel</Button>
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </form>
  );
}
