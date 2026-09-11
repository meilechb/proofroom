import { describe, expect, it } from "vitest";
import {
  bundleTotal,
  cartTotals,
  DEFAULT_STORE,
  discountAmount,
  giftCardSpend,
  lineTotal,
  rmPrice,
  selectPrice,
  storeSettings,
} from "@/lib/store-shared";

describe("lineTotal", () => {
  it("multiplies unit by quantity and clamps", () => {
    expect(lineTotal(7500, 3)).toBe(22500);
    expect(lineTotal(7500, 0)).toBe(0);
    expect(lineTotal(-100, 3)).toBe(0);
    expect(lineTotal(7500, 2.9)).toBe(15000); // qty floored
  });
});

describe("bundleTotal", () => {
  const tiers = [
    { min: 1, unitAmountCents: 5000 },
    { min: 5, unitAmountCents: 4000 },
    { min: 10, unitAmountCents: 3000 },
  ];
  it("uses the deepest tier whose min <= count", () => {
    expect(bundleTotal(1, tiers)).toBe(5000);
    expect(bundleTotal(4, tiers)).toBe(20000);
    expect(bundleTotal(5, tiers)).toBe(20000); // 5 * 4000
    expect(bundleTotal(10, tiers)).toBe(30000); // 10 * 3000
    expect(bundleTotal(12, tiers)).toBe(36000);
  });
  it("is zero for no items or no tiers", () => {
    expect(bundleTotal(0, tiers)).toBe(0);
    expect(bundleTotal(5, [])).toBe(0);
  });
});

describe("selectPrice", () => {
  const prices = [
    { resolution: "web" as const, license: "personal" as const, amount_cents: 1500, is_active: true },
    { resolution: "original" as const, license: "personal" as const, amount_cents: 7500, is_active: true },
    { resolution: "original" as const, license: "rf" as const, amount_cents: 30000, is_active: false },
  ];
  it("returns the active matching price or null", () => {
    expect(selectPrice(prices, "original", "personal")).toBe(7500);
    expect(selectPrice(prices, "web", "personal")).toBe(1500);
    expect(selectPrice(prices, "original", "rf")).toBeNull(); // inactive
    expect(selectPrice(prices, "standard", "personal")).toBeNull();
  });
});

describe("discountAmount", () => {
  it("percent, rounded and clamped to subtotal", () => {
    expect(discountAmount(10000, { kind: "percent", value: 10 })).toBe(1000);
    expect(discountAmount(9999, { kind: "percent", value: 15 })).toBe(1500);
    expect(discountAmount(10000, { kind: "percent", value: 150 })).toBe(10000);
  });
  it("fixed, clamped to subtotal", () => {
    expect(discountAmount(10000, { kind: "fixed", value: 2500 })).toBe(2500);
    expect(discountAmount(1000, { kind: "fixed", value: 2500 })).toBe(1000);
  });
  it("respects a minimum subtotal", () => {
    expect(discountAmount(4000, { kind: "fixed", value: 1000, min_subtotal_cents: 5000 })).toBe(0);
    expect(discountAmount(6000, { kind: "fixed", value: 1000, min_subtotal_cents: 5000 })).toBe(1000);
  });
  it("free_ship never touches the digital subtotal, null is zero", () => {
    expect(discountAmount(10000, { kind: "free_ship", value: 0 })).toBe(0);
    expect(discountAmount(10000, null)).toBe(0);
  });
});

describe("giftCardSpend", () => {
  it("spends the lesser of due and balance", () => {
    expect(giftCardSpend(8000, 5000)).toBe(5000);
    expect(giftCardSpend(3000, 5000)).toBe(3000);
    expect(giftCardSpend(-1, 5000)).toBe(0);
  });
});

describe("rmPrice", () => {
  const matrix = [
    { when: { media: "web", territory: "us" }, amountCents: 20000 },
    { when: { media: "print", territory: "us" }, amountCents: 50000 },
  ];
  it("returns the first fully matching row", () => {
    expect(rmPrice({ media: "web", territory: "us" }, matrix)).toBe(20000);
    expect(rmPrice({ media: "print", territory: "us" }, matrix)).toBe(50000);
  });
  it("null when nothing matches or no matrix (request a quote)", () => {
    expect(rmPrice({ media: "web", territory: "eu" }, matrix)).toBeNull();
    expect(rmPrice({ media: "web" }, null)).toBeNull();
    expect(rmPrice({ media: "web" }, [])).toBeNull();
  });
});

describe("cartTotals", () => {
  const lines = [
    { unitAmountCents: 7500, qty: 2 }, // 15000
    { unitAmountCents: 3000, qty: 1 }, // 3000
  ];
  it("sums a plain cart", () => {
    expect(cartTotals(lines)).toEqual({ subtotalCents: 18000, discountCents: 0, taxCents: 0, giftCardCents: 0, totalCents: 18000 });
  });
  it("applies discount, then tax, then gift card", () => {
    const t = cartTotals(lines, { discount: { kind: "percent", value: 10 }, taxCents: 500, giftCardBalanceCents: 100000 });
    // subtotal 18000, discount 1800 → 16200, +tax 500 = 16700, gift card covers all → total 0
    expect(t.discountCents).toBe(1800);
    expect(t.taxCents).toBe(500);
    expect(t.giftCardCents).toBe(16700);
    expect(t.totalCents).toBe(0);
  });
  it("gift card only spends up to the amount due", () => {
    const t = cartTotals(lines, { giftCardBalanceCents: 5000 });
    expect(t.giftCardCents).toBe(5000);
    expect(t.totalCents).toBe(13000);
  });
});

describe("storeSettings", () => {
  it("returns defaults for an empty studio", () => {
    expect(storeSettings({})).toEqual(DEFAULT_STORE);
    expect(storeSettings(null).downloadMaxCount).toBe(5);
    expect(storeSettings(undefined).paymentMode).toBe("connected");
  });
  it("merges stored values over defaults", () => {
    const s = storeSettings({ store: { enabled: true, paymentMode: "manual", downloadMaxCount: 3 } });
    expect(s.enabled).toBe(true);
    expect(s.paymentMode).toBe("manual");
    expect(s.downloadMaxCount).toBe(3);
    expect(s.downloadWindowHours).toBe(120); // untouched default
  });
});
