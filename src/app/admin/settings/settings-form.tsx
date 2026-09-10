"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";
import { Field, Input, Textarea } from "@/components/ui";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { savePlatformSettingsAction } from "./actions";

export function PlatformSettingsForm({ settings }: { settings: { signups_open: boolean; maintenance_banner: string; min_plugin_version: string } }) {
  const [state, action] = useActionState(savePlatformSettingsAction, initialActionState);
  return (
    <form action={action} className="space-y-4 max-w-lg">
      <FormMessage state={state} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="signups_open" defaultChecked={settings.signups_open} className="mt-1 h-4 w-4" />
        <span><strong>Signups open.</strong> When off, the signup page is closed to new studios.</span>
      </label>
      <Field label="Maintenance banner" htmlFor="maintenance_banner" hint="Shown across the studio app. Leave blank for none.">
        <Textarea id="maintenance_banner" name="maintenance_banner" defaultValue={settings.maintenance_banner} rows={2} />
      </Field>
      <Field label="Minimum plugin version" htmlFor="min_plugin_version" hint="Lightroom plugins older than this are asked to update.">
        <Input id="min_plugin_version" name="min_plugin_version" defaultValue={settings.min_plugin_version} className="max-w-32" />
      </Field>
      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}
