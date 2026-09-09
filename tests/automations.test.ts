import { describe, expect, it } from "vitest";
import { AUTOMATION_RULES, automationSettings, automationsPaused } from "@/lib/automations";

describe("automation settings", () => {
  it("fills defaults and clamps days", () => {
    const s = automationSettings({ automations: { thank_you: { enabled: true, days: 500 }, gallery_expiring: { days: -3 } } });
    expect(s.thank_you).toEqual({ enabled: true, days: 60 });
    expect(s.gallery_expiring).toEqual({ enabled: true, days: 0 });
    expect(s.balance_reminder).toEqual({ enabled: true, days: 3 });
    expect(Object.keys(s)).toHaveLength(AUTOMATION_RULES.length);
  });
  it("reads the pause switch", () => {
    expect(automationsPaused({ automations_paused: true })).toBe(true);
    expect(automationsPaused({})).toBe(false);
    expect(automationsPaused(null)).toBe(false);
  });
});
