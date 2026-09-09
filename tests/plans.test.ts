import { describe, expect, it } from "vitest";
import { billingState, formatBytes, formatPrice, GRACE_DAYS, PLAN, TRIAL_DAYS } from "@/lib/plans";

const day = 86400000;
const now = new Date("2026-09-09T12:00:00Z");
const iso = (d: Date) => d.toISOString();

const base = { plan: "studio", trial_ends_at: null as string | null, subscription_status: null as string | null, current_period_end: null as string | null };

describe("PLAN", () => {
  it("is the single $40/month plan", () => {
    expect(PLAN.id).toBe("studio");
    expect(PLAN.monthlyCents).toBe(4000);
    expect(PLAN.lookupKey).toBe("studio_monthly");
    expect(TRIAL_DAYS).toBe(14);
  });
});

describe("billingState", () => {
  it("is trialing while the trial end is in the future and there is no subscription", () => {
    const s = billingState({ ...base, trial_ends_at: iso(new Date(now.getTime() + 5 * day)) }, now);
    expect(s.status).toBe("trialing");
    expect(s.trialDaysLeft).toBe(5);
    expect(s.canWrite).toBe(true);
    expect(s.publicLive).toBe(true);
  });

  it("rounds a partial day up so the last day still shows 1", () => {
    const s = billingState({ ...base, trial_ends_at: iso(new Date(now.getTime() + 3600000)) }, now);
    expect(s.status).toBe("trialing");
    expect(s.trialDaysLeft).toBe(1);
  });

  it("is active with a paying subscription regardless of trial dates", () => {
    const s = billingState({ ...base, subscription_status: "active", trial_ends_at: iso(new Date(now.getTime() - day)) }, now);
    expect(s.status).toBe("active");
    expect(s.canWrite).toBe(true);
  });

  it("treats a Stripe trialing subscription as active", () => {
    expect(billingState({ ...base, subscription_status: "trialing" }, now).status).toBe("active");
  });

  it("is past_due when the last payment failed, and still writable", () => {
    const s = billingState({ ...base, subscription_status: "past_due" }, now);
    expect(s.status).toBe("past_due");
    expect(s.canWrite).toBe(true);
    expect(s.publicLive).toBe(true);
  });

  it("is read_only the moment the trial ends, with a grace end GRACE_DAYS later", () => {
    const trialEnd = new Date(now.getTime() - 1000);
    const s = billingState({ ...base, trial_ends_at: iso(trialEnd) }, now);
    expect(s.status).toBe("read_only");
    expect(s.canWrite).toBe(false);
    expect(s.publicLive).toBe(true);
    expect(s.graceEndsAt?.getTime()).toBe(trialEnd.getTime() + GRACE_DAYS * day);
  });

  it("is locked once the grace period is over", () => {
    const trialEnd = new Date(now.getTime() - (GRACE_DAYS + 1) * day);
    const s = billingState({ ...base, trial_ends_at: iso(trialEnd) }, now);
    expect(s.status).toBe("locked");
    expect(s.publicLive).toBe(false);
  });

  it("locks exactly at the grace boundary", () => {
    const trialEnd = new Date(now.getTime() - GRACE_DAYS * day);
    expect(billingState({ ...base, trial_ends_at: iso(trialEnd) }, now).status).toBe("locked");
  });

  it("honours an explicit grace_ends_at over the computed one", () => {
    const s = billingState({ ...base, trial_ends_at: iso(new Date(now.getTime() - 60 * day)), grace_ends_at: iso(new Date(now.getTime() + day)) }, now);
    expect(s.status).toBe("read_only");
  });

  it("is read_only after a cancelled subscription ends", () => {
    const s = billingState({ ...base, subscription_status: "canceled", read_only_since: iso(new Date(now.getTime() - day)) }, now);
    expect(s.status).toBe("read_only");
  });

  it("is active when comped by a platform admin", () => {
    expect(billingState({ ...base, plan_override: "comped" }, now).status).toBe("active");
  });

  it("suspension blocks writes and public pages even when active", () => {
    const s = billingState({ ...base, subscription_status: "active", suspended_at: iso(now) }, now);
    expect(s.status).toBe("active");
    expect(s.suspended).toBe(true);
    expect(s.canWrite).toBe(false);
    expect(s.publicLive).toBe(false);
  });

  it("reports cancelling when cancel_at_period_end is set", () => {
    expect(billingState({ ...base, subscription_status: "active", cancel_at_period_end: true }, now).cancelling).toBe(true);
  });
});

describe("formatting", () => {
  it("formats prices", () => {
    expect(formatPrice(4000)).toBe("$40");
    expect(formatPrice(4050)).toBe("$40.50");
  });
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1536)).toBe("1.50 KB");
    expect(formatBytes(5 * 1024 ** 3)).toBe("5.00 GB");
  });
});
