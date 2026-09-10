import { describe, expect, it } from "vitest";
import { hasRole } from "@/lib/auth";
import { validTimezone } from "@/lib/account";
import { resolvePrefs, NOTIFICATION_KEYS } from "@/lib/notifications-shared";

/**
 * Settings actions gate on a required role (plan 17.9). These assert the policy
 * the actions rely on: invite needs admin, delete-studio and transfer need owner.
 */
describe("role gates on settings actions (plan 17.9)", () => {
  it("a member cannot do admin-only actions (invite, branding, tokens)", () => {
    expect(hasRole("member", "admin")).toBe(false);
    expect(hasRole("member", "owner")).toBe(false);
  });
  it("an admin can invite but cannot delete the studio or transfer ownership", () => {
    expect(hasRole("admin", "admin")).toBe(true);
    expect(hasRole("admin", "owner")).toBe(false);
  });
  it("the owner can do everything", () => {
    expect(hasRole("owner", "admin")).toBe(true);
    expect(hasRole("owner", "owner")).toBe(true);
  });
});

describe("timezone validation (plan 17.2)", () => {
  it("accepts real IANA names and rejects nonsense", () => {
    expect(validTimezone("America/New_York")).toBeTruthy();
    expect(validTimezone("Europe/London")).toBeTruthy();
    expect(validTimezone("Not/AZone")).toBeFalsy();
    expect(validTimezone("")).toBeFalsy();
  });
});

describe("notification preferences (plan 17.5)", () => {
  it("fills defaults and honors stored overrides", () => {
    const def = resolvePrefs(null);
    expect(def.new_inquiry).toBe(true);
    expect(def.daily_digest).toBe(false);
    const overridden = resolvePrefs({ new_inquiry: false, daily_digest: true });
    expect(overridden.new_inquiry).toBe(false);
    expect(overridden.daily_digest).toBe(true);
  });
  it("covers every key", () => {
    const prefs = resolvePrefs({});
    for (const { key } of NOTIFICATION_KEYS) expect(typeof prefs[key]).toBe("boolean");
  });
});
