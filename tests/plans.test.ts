import { describe, expect, it } from "vitest";
import { billingState, entitlements, formatBytes, formatPrice, FREE_STORAGE_BYTES, PLANS, PRO_SEAT_CENTS, TRIAL_DAYS } from "@/lib/plans";

const day = 86400000;
const now = new Date("2026-09-09T12:00:00Z");
const iso = (d: Date) => d.toISOString();

const base = { plan: "free", trial_ends_at: null as string | null, subscription_status: null as string | null, current_period_end: null as string | null };

describe("PLANS", () => {
  it("has a free and a per-seat pro plan", () => {
    expect(PLANS.free.id).toBe("free");
    expect(PLANS.pro.id).toBe("pro");
    expect(PLANS.pro.pricePerSeatCents).toBe(PRO_SEAT_CENTS);
    expect(PRO_SEAT_CENTS).toBe(1800);
    expect(PLANS.pro.lookupKey).toBe("pro_seat_monthly");
    expect(TRIAL_DAYS).toBe(14);
  });
});

describe("entitlements", () => {
  it("caps storage and seats on free but keeps payments and lightroom", () => {
    const e = entitlements("free");
    expect(e.storageBytes).toBe(FREE_STORAGE_BYTES);
    expect(e.maxSeats).toBe(1);
    expect(e.payments).toBe(true);
    expect(e.lightroom).toBe(true);
    expect(e.customDomain).toBe(false);
    expect(e.sendingDomain).toBe(false);
    expect(e.automations).toBe(false);
    expect(e.booking).toBe(false);
    expect(e.imports).toBe(false);
    expect(e.sessionPlanning).toBe(false);
    expect(e.removeBranding).toBe(false);
    expect(e.referralReward).toBe(false);
  });

  it("uncaps everything on pro", () => {
    const e = entitlements("pro");
    expect(e.storageBytes).toBeNull();
    expect(e.maxSeats).toBeNull();
    for (const flag of ["customDomain", "sendingDomain", "automations", "booking", "imports", "sessionPlanning", "removeBranding", "referralReward", "payments", "lightroom"] as const) {
      expect(e[flag]).toBe(true);
    }
  });
});

describe("billingState", () => {
  it("is trialing on full Pro while the trial end is in the future and there is no subscription", () => {
    const s = billingState({ ...base, trial_ends_at: iso(new Date(now.getTime() + 5 * day)) }, now);
    expect(s.status).toBe("trialing");
    expect(s.effectivePlan).toBe("pro");
    expect(s.trialDaysLeft).toBe(5);
    expect(s.canWrite).toBe(true);
    expect(s.publicLive).toBe(true);
  });

  it("rounds a partial day up so the last day still shows 1", () => {
    const s = billingState({ ...base, trial_ends_at: iso(new Date(now.getTime() + 3600000)) }, now);
    expect(s.status).toBe("trialing");
    expect(s.trialDaysLeft).toBe(1);
  });

  it("is active on Pro with a paying subscription regardless of trial dates", () => {
    const s = billingState({ ...base, plan: "pro", subscription_status: "active", trial_ends_at: iso(new Date(now.getTime() - day)) }, now);
    expect(s.status).toBe("active");
    expect(s.effectivePlan).toBe("pro");
    expect(s.plan).toBe("pro");
    expect(s.canWrite).toBe(true);
  });

  it("treats a Stripe trialing subscription as active", () => {
    expect(billingState({ ...base, subscription_status: "trialing" }, now).status).toBe("active");
  });

  it("is past_due when the last payment failed, and still writable on Pro", () => {
    const s = billingState({ ...base, plan: "pro", subscription_status: "past_due" }, now);
    expect(s.status).toBe("past_due");
    expect(s.effectivePlan).toBe("pro");
    expect(s.canWrite).toBe(true);
    expect(s.publicLive).toBe(true);
  });

  it("drops to Free (writable, gated) the moment the trial ends with no subscription", () => {
    const trialEnd = new Date(now.getTime() - 1000);
    const s = billingState({ ...base, trial_ends_at: iso(trialEnd) }, now);
    expect(s.status).toBe("free");
    expect(s.effectivePlan).toBe("free");
    expect(s.canWrite).toBe(true);
    expect(s.publicLive).toBe(true);
    expect(s.graceEndsAt).toBeNull();
  });

  it("drops to Free exactly at the trial boundary", () => {
    const trialEnd = new Date(now.getTime());
    expect(billingState({ ...base, trial_ends_at: iso(trialEnd) }, now).status).toBe("free");
  });

  it("is Free after a cancelled subscription ends", () => {
    const s = billingState({ ...base, subscription_status: "canceled", read_only_since: iso(new Date(now.getTime() - day)) }, now);
    expect(s.status).toBe("free");
    expect(s.effectivePlan).toBe("free");
    expect(s.canWrite).toBe(true);
  });

  it("is active on Pro when comped by a platform admin", () => {
    const s = billingState({ ...base, plan_override: "comped" }, now);
    expect(s.status).toBe("active");
    expect(s.effectivePlan).toBe("pro");
  });

  it("suspension blocks writes and public pages even when active", () => {
    const s = billingState({ ...base, plan: "pro", subscription_status: "active", suspended_at: iso(now) }, now);
    expect(s.status).toBe("active");
    expect(s.suspended).toBe(true);
    expect(s.canWrite).toBe(false);
    expect(s.publicLive).toBe(false);
  });

  it("suspension blocks a Free studio too", () => {
    const s = billingState({ ...base, suspended_at: iso(now) }, now);
    expect(s.status).toBe("free");
    expect(s.canWrite).toBe(false);
    expect(s.publicLive).toBe(false);
  });

  it("reports cancelling when cancel_at_period_end is set", () => {
    expect(billingState({ ...base, plan: "pro", subscription_status: "active", cancel_at_period_end: true }, now).cancelling).toBe(true);
  });
});

describe("formatting", () => {
  it("formats prices", () => {
    expect(formatPrice(1800)).toBe("$18");
    expect(formatPrice(4050)).toBe("$40.50");
  });
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1536)).toBe("1.50 KB");
    expect(formatBytes(5 * 1024 ** 3)).toBe("5.00 GB");
  });
});
