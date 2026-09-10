/**
 * Client-safe notification keys and defaults (plan 17.5). Kept out of
 * notifications.ts so the account form can render the options without pulling in
 * the server-only module.
 */

export const NOTIFICATION_KEYS = [
  { key: "new_inquiry", label: "New inquiry", description: "Someone contacts you through your website." },
  { key: "new_note", label: "New client note", description: "A client leaves a note on a gallery photo." },
  { key: "payment_received", label: "Payment received", description: "A client pays a deposit or balance." },
  { key: "booking_made", label: "Booking made", description: "A client requests or books a session." },
  { key: "daily_digest", label: "Daily digest", description: "A once-a-day summary of activity." },
] as const;

export type NotificationKey = (typeof NOTIFICATION_KEYS)[number]["key"];

const DEFAULTS: Record<NotificationKey, boolean> = { new_inquiry: true, new_note: true, payment_received: true, booking_made: true, daily_digest: false };

export function resolvePrefs(raw: unknown): Record<NotificationKey, boolean> {
  const stored = (raw ?? {}) as Partial<Record<NotificationKey, boolean>>;
  const out = {} as Record<NotificationKey, boolean>;
  for (const { key } of NOTIFICATION_KEYS) out[key] = stored[key] ?? DEFAULTS[key];
  return out;
}
