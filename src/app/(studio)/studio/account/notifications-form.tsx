"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";
import { NOTIFICATION_KEYS, type NotificationKey } from "@/lib/notifications-shared";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { saveNotificationPrefsAction } from "./actions";

export function NotificationsForm({ prefs }: { prefs: Record<NotificationKey, boolean> }) {
  const [state, action] = useActionState(saveNotificationPrefsAction, initialActionState);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <ul className="divide-y divide-line">
        {NOTIFICATION_KEYS.map((n) => (
          <li key={n.key}>
            <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
              <span className="min-w-0">
                <span className="block text-sm font-medium">{n.label}</span>
                <span className="block text-xs text-ink-2">{n.description}</span>
              </span>
              <input type="checkbox" name={`notify_${n.key}`} defaultChecked={prefs[n.key]} className="peer sr-only" />
              <span aria-hidden className="relative h-[26px] w-[46px] shrink-0 rounded-full bg-line-2 transition-colors peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 peer-focus-visible:ring-offset-1 after:absolute after:left-[3px] after:top-[3px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-[19px]" />
            </label>
          </li>
        ))}
      </ul>
      <SubmitButton variant="secondary">Save notifications</SubmitButton>
    </form>
  );
}
