import type { TemplateKey } from "@/lib/email-templates";

/**
 * Client-safe automation definitions and settings helpers (plan 3.83, 16.7).
 * Kept out of automations.ts so client components (the settings form) can import
 * them without pulling in the server-only runner.
 */

export type AutomationRule = "balance_reminder" | "gallery_expiring" | "unanswered_note" | "thank_you" | "review_request" | "session_reminder";

export type RuleDef = { rule: AutomationRule; template: TemplateKey; label: string; defaultDays: number; defaultEnabled: boolean; description: string };

export const AUTOMATION_RULES: RuleDef[] = [
  { rule: "balance_reminder", template: "balance_reminder", label: "Remind about an unpaid balance", defaultDays: 3, defaultEnabled: true, description: "Days after finals are delivered while the balance is still unpaid." },
  { rule: "gallery_expiring", template: "gallery_expiring", label: "Warn before a gallery closes", defaultDays: 7, defaultEnabled: true, description: "Days before a gallery's expiry date." },
  { rule: "unanswered_note", template: "inquiry_reply", label: "Nudge you about unanswered client notes", defaultDays: 2, defaultEnabled: true, description: "Days a client note has waited without a reply (sent to you, not the client)." },
  { rule: "thank_you", template: "thank_you", label: "Send a thank-you note", defaultDays: 2, defaultEnabled: false, description: "Days after the final gallery is delivered and paid." },
  { rule: "review_request", template: "review_request", label: "Ask for a review", defaultDays: 7, defaultEnabled: false, description: "Days after delivery." },
  { rule: "session_reminder", template: "booking_reminder", label: "Remind clients the day before", defaultDays: 1, defaultEnabled: true, description: "Days before the session." },
];

export type AutomationSettings = Record<AutomationRule, { enabled: boolean; days: number }>;

export function automationSettings(settings: Record<string, unknown> | null | undefined): AutomationSettings {
  const raw = (settings?.automations ?? {}) as Partial<Record<AutomationRule, { enabled?: boolean; days?: number }>>;
  const out = {} as AutomationSettings;
  for (const def of AUTOMATION_RULES) {
    const v = raw[def.rule] ?? {};
    out[def.rule] = { enabled: v.enabled ?? def.defaultEnabled, days: Math.min(60, Math.max(0, Math.round(v.days ?? def.defaultDays))) };
  }
  return out;
}

export function automationsPaused(settings: Record<string, unknown> | null | undefined) {
  return Boolean((settings as { automations_paused?: boolean } | null | undefined)?.automations_paused);
}
