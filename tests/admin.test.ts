import { describe, expect, it } from "vitest";
import { studioState } from "@/lib/admin";
import { billingState } from "@/lib/plans";

const base = {
  deleted_at: null as string | null,
  suspended_at: null as string | null,
  plan_override: null as string | null,
  read_only_since: null as string | null,
  subscription_status: null as string | null,
  trial_ends_at: null as string | null,
  current_period_end: null as string | null,
};

describe("studio state labels (plan 19.2, 19.12)", () => {
  it("prioritizes deleted, then suspended, then comped", () => {
    expect(studioState({ ...base, deleted_at: "2026-01-01", suspended_at: "2026-01-01" })).toBe("deleted");
    expect(studioState({ ...base, suspended_at: "2026-01-01", plan_override: "comped" })).toBe("suspended");
    expect(studioState({ ...base, plan_override: "comped" })).toBe("comped");
  });
  it("shows an active trial and an active subscription", () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString();
    expect(studioState({ ...base, trial_ends_at: future })).toBe("trial");
    expect(studioState({ ...base, subscription_status: "active", current_period_end: future })).toBe("active");
  });
});

describe("suspend blocks studio writes (plan 19.12)", () => {
  it("a suspended studio is read-only in billing", () => {
    // billingState.canWrite gates requireWritableStudio; suspension forces it false.
    const suspended = billingState({ plan: "studio", trial_ends_at: null, subscription_status: "active", current_period_end: null, suspended_at: new Date().toISOString() });
    expect(suspended.canWrite).toBe(false);
  });
});
