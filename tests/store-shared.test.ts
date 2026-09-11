import { describe, expect, it } from "vitest";
import {
  bundlePickTotal,
  bundleTotal,
  cartTotals,
  cleanRmUsage,
  DEFAULT_STORE,
  DIGITAL_EXTENSIONS,
  digitalExtOk,
  discountAmount,
  effectivePrice,
  giftCardSpend,
  isCompleteRmUsage,
  lineTotal,
  normalizeGiftCode,
  parseRmMatrix,
  parseVolumeTiers,
  resolveStorePrice,
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

describe("bundlePickTotal", () => {
  it("applies the base price below the lowest tier", () => {
    const tiers = [{ min: 5, unitAmountCents: 1200 }, { min: 10, unitAmountCents: 1000 }];
    expect(bundlePickTotal(2, 1500, tiers)).toBe(3000); // 2 * base 1500
    expect(bundlePickTotal(5, 1500, tiers)).toBe(6000); // 5 * 1200
    expect(bundlePickTotal(10, 1500, tiers)).toBe(10000); // 10 * 1000
  });
  it("with no tiers is just base * count; an explicit min-1 tier overrides the base", () => {
    expect(bundlePickTotal(3, 1500, [])).toBe(4500);
    expect(bundlePickTotal(3, 1500, [{ min: 1, unitAmountCents: 1000 }])).toBe(3000);
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

describe("normalizeGiftCode", () => {
  it("uppercases and strips separators and spaces so any typed form matches", () => {
    expect(normalizeGiftCode("abcd-efgh-jklm-npqr")).toBe("ABCDEFGHJKLMNPQR");
    expect(normalizeGiftCode("ABCD EFGH")).toBe("ABCDEFGH");
    expect(normalizeGiftCode(" a1b2 ")).toBe("A1B2");
    expect(normalizeGiftCode("")).toBe("");
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

describe("parseRmMatrix", () => {
  it("keeps valid rows and drops malformed ones and unknown dimensions", () => {
    const rows = parseRmMatrix([
      { when: { usage: "commercial", territory: "worldwide", junk: "x" }, amountCents: 50000 },
      { when: { usage: "editorial" }, amountCents: 20000 }, // partial row is allowed
      { when: { usage: "not-a-usage" }, amountCents: 1000 }, // invalid option → dropped from `when`
      { when: {}, amountCents: -5 }, // negative amount → whole row dropped
      { amountCents: "10" }, // no when, coercible amount
    ]);
    expect(rows).toEqual([
      { when: { usage: "commercial", territory: "worldwide" }, amountCents: 50000 },
      { when: { usage: "editorial" }, amountCents: 20000 },
      { when: {}, amountCents: 1000 },
      { when: {}, amountCents: 10 },
    ]);
    expect(parseRmMatrix(null)).toEqual([]);
    expect(parseRmMatrix("nope")).toEqual([]);
  });
  it("a partial row prices any scope that satisfies its pinned keys", () => {
    const matrix = parseRmMatrix([{ when: { usage: "commercial" }, amountCents: 50000 }]);
    expect(rmPrice({ usage: "commercial", term: "1y", territory: "local" }, matrix)).toBe(50000);
    expect(rmPrice({ usage: "editorial", term: "1y", territory: "local" }, matrix)).toBeNull();
  });
});

describe("effectivePrice", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  it("no compare-at → just the amount", () => {
    expect(effectivePrice({ amount_cents: 7500, compare_at_cents: null, sale_starts_at: null, sale_ends_at: null }, now)).toEqual({ priceCents: 7500, compareAtCents: null, onSale: false });
  });
  it("compare-at with no window is a standing sale (amount is the sale price)", () => {
    expect(effectivePrice({ amount_cents: 5000, compare_at_cents: 8000, sale_starts_at: null, sale_ends_at: null }, now)).toEqual({ priceCents: 5000, compareAtCents: 8000, onSale: true });
  });
  it("inside the window charges the sale price and strikes through the was-price", () => {
    expect(effectivePrice({ amount_cents: 5000, compare_at_cents: 8000, sale_starts_at: "2026-06-01T00:00:00Z", sale_ends_at: "2026-06-30T00:00:00Z" }, now)).toEqual({ priceCents: 5000, compareAtCents: 8000, onSale: true });
  });
  it("outside the window charges the regular (compare-at) price, no strikethrough", () => {
    expect(effectivePrice({ amount_cents: 5000, compare_at_cents: 8000, sale_starts_at: "2026-07-01T00:00:00Z", sale_ends_at: null }, now)).toEqual({ priceCents: 8000, compareAtCents: null, onSale: false });
    expect(effectivePrice({ amount_cents: 5000, compare_at_cents: 8000, sale_starts_at: null, sale_ends_at: "2026-06-01T00:00:00Z" }, now)).toEqual({ priceCents: 8000, compareAtCents: null, onSale: false });
  });
  it("a compare-at at or below the amount is not a sale", () => {
    expect(effectivePrice({ amount_cents: 5000, compare_at_cents: 4000, sale_starts_at: null, sale_ends_at: null }, now)).toEqual({ priceCents: 5000, compareAtCents: null, onSale: false });
  });
});

describe("resolveStorePrice", () => {
  const base = { is_active: true, rm_matrix: null, compare_at_cents: null, sale_starts_at: null, sale_ends_at: null };
  const prices = [
    { resolution: "original" as const, license: "personal" as const, amount_cents: 7500, ...base },
    { resolution: "original" as const, license: "rf" as const, amount_cents: 0, ...base }, // zero → not for sale
    { resolution: "original" as const, license: "rm" as const, amount_cents: 30000, ...base, rm_matrix: [{ when: { usage: "commercial" }, amountCents: 50000 }] },
    { resolution: "web" as const, license: "rm" as const, amount_cents: 12000, ...base }, // flat rm, no matrix
  ];
  it("flat licences use amount_cents (or null when zero)", () => {
    expect(resolveStorePrice(prices, "original", "personal")).toEqual({ amountCents: 7500 });
    expect(resolveStorePrice(prices, "original", "rf")).toBeNull();
    expect(resolveStorePrice(prices, "standard", "personal")).toBeNull();
  });
  it("rm with a matrix prices from the matrix, else quotes", () => {
    expect(resolveStorePrice(prices, "original", "rm", { usage: "commercial", term: "1y", territory: "local" })).toEqual({ amountCents: 50000 });
    expect(resolveStorePrice(prices, "original", "rm", { usage: "editorial", term: "1y", territory: "local" })).toEqual({ quote: true });
    expect(resolveStorePrice(prices, "original", "rm", { usage: "commercial" })).toEqual({ quote: true }); // incomplete usage
    expect(resolveStorePrice(prices, "original", "rm")).toEqual({ quote: true });
  });
  it("rm with no matrix is a flat price and records usage", () => {
    expect(resolveStorePrice(prices, "web", "rm", { usage: "commercial", term: "1y", territory: "local" })).toEqual({ amountCents: 12000 });
  });
});

describe("cleanRmUsage / isCompleteRmUsage", () => {
  it("cleans unknown keys and invalid options", () => {
    expect(cleanRmUsage({ usage: "commercial", term: "3y", territory: "national", junk: "x" })).toEqual({ usage: "commercial", term: "3y", territory: "national" });
    expect(cleanRmUsage({ usage: "bogus" })).toEqual({});
    expect(cleanRmUsage(null)).toEqual({});
  });
  it("is complete only when every dimension is a valid option", () => {
    expect(isCompleteRmUsage({ usage: "commercial", term: "3y", territory: "national" })).toBe(true);
    expect(isCompleteRmUsage({ usage: "commercial", term: "3y" })).toBe(false);
    expect(isCompleteRmUsage({ usage: "commercial", term: "3y", territory: "mars" })).toBe(false);
  });
});

describe("parseVolumeTiers", () => {
  it("keeps valid tiers, sorted and deduped by min", () => {
    expect(parseVolumeTiers([{ min: 10, unitAmountCents: 3000 }, { min: 1, unitAmountCents: 5000 }])).toEqual([
      { min: 1, unitAmountCents: 5000 },
      { min: 10, unitAmountCents: 3000 },
    ]);
    // last wins on a duplicate min
    expect(parseVolumeTiers([{ min: 5, unitAmountCents: 4000 }, { min: 5, unitAmountCents: 3500 }])).toEqual([{ min: 5, unitAmountCents: 3500 }]);
  });
  it("drops malformed rows and parses a json string", () => {
    expect(parseVolumeTiers([{ min: 0, unitAmountCents: 100 }, { min: 2, unitAmountCents: -1 }, { min: 3 }])).toEqual([]);
    expect(parseVolumeTiers('[{"min":1,"unitAmountCents":900}]')).toEqual([{ min: 1, unitAmountCents: 900 }]);
    expect(parseVolumeTiers(null)).toEqual([]);
    expect(parseVolumeTiers("not json")).toEqual([]);
  });
});

describe("digitalExtOk", () => {
  it("accepts the sellable download extensions, case-insensitively", () => {
    expect(digitalExtOk("summer-tones.xmp")).toBe(true);
    expect(digitalExtOk("PACK.ZIP")).toBe(true);
    expect(digitalExtOk("guide.pdf")).toBe(true);
    expect(digitalExtOk("cinema.CUBE")).toBe(true);
    expect(digitalExtOk("my.preset.pack.zip")).toBe(true); // matches on the last segment
  });
  it("rejects images, executables and extensionless names", () => {
    expect(digitalExtOk("photo.jpg")).toBe(false);
    expect(digitalExtOk("evil.exe")).toBe(false);
    expect(digitalExtOk("README")).toBe(false);
    expect(digitalExtOk("")).toBe(false);
  });
  it("every listed extension passes", () => {
    for (const ext of DIGITAL_EXTENSIONS) expect(digitalExtOk(`file.${ext}`)).toBe(true);
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
