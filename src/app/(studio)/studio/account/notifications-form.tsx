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
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <ul className="space-y-2">
        {NOTIFICATION_KEYS.map((n) => (
          <li key={n.key}>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name={`notify_${n.key}`} defaultChecked={prefs[n.key]} className="mt-1 h-4 w-4" />
              <span><span className="font-medium">{n.label}</span><br /><span className="text-xs text-ink-2">{n.description}</span></span>
            </label>
          </li>
        ))}
      </ul>
      <SubmitButton variant="secondary">Save notifications</SubmitButton>
    </form>
  );
}
