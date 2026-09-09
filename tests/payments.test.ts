import { describe, expect, it } from "vitest";
import { orderMoney } from "@/lib/types";
import { amountForKind, statusAfterRefund } from "@/lib/payments";
import { accountSnapshot, signConnectState, verifyConnectState } from "@/lib/connect";

const order = { amount_cents: 40000, deposit_cents: 15000, included_finals: 5, extra_final_cents: 4000 };

describe("orderMoney", () => {
  it("starts with everything due", () => {
    const m = orderMoney(order, [], 0);
    expect(m.total_cents).toBe(40000);
    expect(m.deposit_due_cents).toBe(15000);
    expect(m.due_cents).toBe(40000);
    expect(m.deposit_paid).toBe(false);
  });
  it("counts a deposit and then the balance", () => {
    const m1 = orderMoney(order, [{ amount_cents: 15000, status: "paid" }], 0);
    expect(m1.deposit_paid).toBe(true);
    expect(m1.due_cents).toBe(25000);
    const m2 = orderMoney(order, [{ amount_cents: 15000, status: "paid" }, { amount_cents: 25000, status: "paid" }], 0);
    expect(m2.fully_paid).toBe(true);
  });
  it("adds extra picks beyond the included finals", () => {
    const m = orderMoney(order, [], 7);
    expect(m.extra_picks).toBe(2);
    expect(m.total_cents).toBe(48000);
  });
  it("applies a discount and never goes negative", () => {
    expect(orderMoney({ ...order, discount_cents: 5000 }, [], 0).total_cents).toBe(35000);
    expect(orderMoney({ ...order, discount_cents: 99999 }, [], 0).total_cents).toBe(0);
  });
  it("subtracts refunds and ignores failed or disputed payments", () => {
    const m = orderMoney(order, [
      { amount_cents: 15000, status: "partially_refunded", refunded_cents: 5000 },
      { amount_cents: 25000, status: "refunded", refunded_cents: 25000 },
      { amount_cents: 1000, status: "failed" },
      { amount_cents: 1000, status: "disputed" },
    ], 0);
    expect(m.paid_cents).toBe(10000);
    expect(m.deposit_paid).toBe(false);
  });
});

describe("amountForKind", () => {
  it("returns the deposit due, the balance, or null when nothing is due", () => {
    expect(amountForKind(order, [], 0, "deposit")).toBe(15000);
    expect(amountForKind(order, [{ amount_cents: 15000, status: "paid", refunded_cents: 0 }], 0, "deposit")).toBeNull();
    expect(amountForKind(order, [{ amount_cents: 15000, status: "paid", refunded_cents: 0 }], 0, "balance")).toBe(25000);
    expect(amountForKind(order, [{ amount_cents: 40000, status: "paid", refunded_cents: 0 }], 0, "full")).toBeNull();
  });
});

describe("statusAfterRefund", () => {
  it("maps refunded amounts to statuses", () => {
    expect(statusAfterRefund(1000, 0)).toBe("paid");
    expect(statusAfterRefund(1000, 400)).toBe("partially_refunded");
    expect(statusAfterRefund(1000, 1000)).toBe("refunded");
  });
});

describe("connect state", () => {
  const secret = "test-secret-that-is-long-enough-for-hmac";
  it("round-trips and expires", () => {
    const now = 1_700_000_000_000;
    const state = signConnectState("studio-1", now, secret);
    expect(verifyConnectState(state, now + 1000, secret)).toEqual({ studioId: "studio-1" });
    expect(verifyConnectState(state, now + 31 * 60 * 1000, secret)).toBeNull();
  });
  it("rejects tampering and wrong secrets", () => {
    const state = signConnectState("studio-1", Date.now(), secret);
    expect(verifyConnectState(state.replace("studio-1", "studio-2"), Date.now(), secret)).toBeNull();
    expect(verifyConnectState(state, Date.now(), "another-secret")).toBeNull();
    expect(verifyConnectState(null, Date.now(), secret)).toBeNull();
    expect(verifyConnectState("a.b", Date.now(), secret)).toBeNull();
  });
});

describe("accountSnapshot", () => {
  it("derives the connection status", () => {
    expect(accountSnapshot({ charges_enabled: true, details_submitted: true, requirements: null } as never).stripe_account_status).toBe("enabled");
    expect(accountSnapshot({ charges_enabled: false, details_submitted: true, requirements: { currently_due: ["x"] } } as never).stripe_account_status).toBe("restricted");
    expect(accountSnapshot({ charges_enabled: false, details_submitted: false, requirements: null } as never).stripe_account_status).toBe("pending");
  });
});
