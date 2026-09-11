import type { ProductPrice, StoreLicense, StoreResolution } from "@/lib/types";

/**
 * Pure store money and licence maths. No `server-only` import, so it runs in
 * client components and unit tests the same way `booking-shared.ts` and
 * `orderMoney` (types.ts) do. Everything is integer cents; every function
 * clamps to sane, non-negative results.
 */

// ---------------------------------------------------------------------------
// Per-studio store settings (stored under studios.settings.store; read here so
// both the admin form and the public storefront share one shape and defaults).
// ---------------------------------------------------------------------------

export type StorePaymentMode = "connected" | "marketplace" | "manual";

export type StoreSettings = {
  /** Storefront is shown on the tenant site. */
  enabled: boolean;
  paymentMode: StorePaymentMode;
  /** "stripe" turns on Stripe Tax in marketplace mode. */
  taxMode: "off" | "stripe";
  /** Marketplace commission in basis points (100 = 1%). Ignored unless marketplace. */
  commissionBps: number;
  /** Default watermark on for-sale previews. */
  watermark: boolean;
  watermarkText: string | null;
  /** Default download-grant cap and window. */
  downloadMaxCount: number;
  downloadWindowHours: number;
  deliveryPolicy: string | null;
  manualInstructions: string | null;
  manualPaymentLink: string | null;
};

export const DEFAULT_STORE: StoreSettings = {
  enabled: false,
  paymentMode: "connected",
  taxMode: "off",
  commissionBps: 0,
  watermark: true,
  watermarkText: null,
  downloadMaxCount: 5,
  downloadWindowHours: 120,
  deliveryPolicy: null,
  manualInstructions: null,
  manualPaymentLink: null,
};

/** Merge a studio's stored store settings over the defaults. */
export function storeSettings(settings: Record<string, unknown> | null | undefined): StoreSettings {
  const raw = (settings?.store ?? {}) as Partial<StoreSettings>;
  return { ...DEFAULT_STORE, ...raw };
}

// ---------------------------------------------------------------------------
// Pricing maths
// ---------------------------------------------------------------------------

const cents = (n: number) => Math.max(0, Math.round(n));

/** Whole line total for a simple quantity line. */
export function lineTotal(unitAmountCents: number, qty: number): number {
  return cents(unitAmountCents) * Math.max(0, Math.floor(qty));
}

/** A pick-N volume tier: at `min` items and up, each item costs `unitAmountCents`. */
export type VolumeTier = { min: number; unitAmountCents: number };

/** Bundle / pick-N total: the unit price is the deepest tier whose `min <= count`. */
export function bundleTotal(count: number, tiers: VolumeTier[]): number {
  const n = Math.max(0, Math.floor(count));
  if (n === 0 || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  let unit = sorted[0].unitAmountCents;
  for (const t of sorted) if (n >= t.min) unit = t.unitAmountCents;
  return cents(unit) * n;
}

/** Select the active price for a resolution + licence, or null when none matches. */
export function selectPrice(
  prices: Pick<ProductPrice, "resolution" | "license" | "amount_cents" | "is_active">[],
  resolution: StoreResolution,
  license: StoreLicense
): number | null {
  const row = prices.find((p) => p.is_active && p.resolution === resolution && p.license === license);
  return row ? cents(row.amount_cents) : null;
}

export type DiscountKind = "percent" | "fixed" | "free_ship";
export type DiscountLike = { kind: DiscountKind; value: number; min_subtotal_cents?: number | null };

/** Discount amount in cents for a subtotal; never below zero or above the subtotal. */
export function discountAmount(subtotalCents: number, code: DiscountLike | null | undefined): number {
  if (!code) return 0;
  const subtotal = cents(subtotalCents);
  if (code.min_subtotal_cents && subtotal < code.min_subtotal_cents) return 0;
  if (code.kind === "percent") return Math.min(subtotal, Math.round((subtotal * Math.max(0, code.value)) / 100));
  if (code.kind === "fixed") return Math.min(subtotal, cents(code.value));
  return 0; // free_ship applies to shipping, not the digital subtotal
}

/** Gift-card spend against an amount due: min(due, balance). */
export function giftCardSpend(dueCents: number, balanceCents: number): number {
  return Math.min(cents(dueCents), cents(balanceCents));
}

export type RmUsage = Record<string, string | number | boolean | null>;
export type RmMatrixRow = { when: RmUsage; amountCents: number };

/**
 * Rights-managed price from a photographer-defined matrix: the first row whose
 * `when` conditions all match the buyer's usage scope. `null` = no match, i.e.
 * "request a quote".
 */
export function rmPrice(usage: RmUsage, matrix: RmMatrixRow[] | null | undefined): number | null {
  if (!matrix || matrix.length === 0) return null;
  for (const row of matrix) {
    if (Object.entries(row.when).every(([k, v]) => usage[k] === v)) return cents(row.amountCents);
  }
  return null;
}

export type CartLine = { unitAmountCents: number; qty: number };
export type CartTotals = {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  giftCardCents: number;
  totalCents: number;
};

/** Cart totals in cents: subtotal → discount → tax → gift card → total. */
export function cartTotals(
  lines: CartLine[],
  opts: { discount?: DiscountLike | null; giftCardBalanceCents?: number; taxCents?: number } = {}
): CartTotals {
  const subtotalCents = lines.reduce((sum, l) => sum + lineTotal(l.unitAmountCents, l.qty), 0);
  const discountCents = discountAmount(subtotalCents, opts.discount);
  const taxCents = cents(opts.taxCents ?? 0);
  const dueBeforeGift = subtotalCents - discountCents + taxCents;
  const giftCardCents = giftCardSpend(dueBeforeGift, opts.giftCardBalanceCents ?? 0);
  const totalCents = Math.max(0, dueBeforeGift - giftCardCents);
  return { subtotalCents, discountCents, taxCents, giftCardCents, totalCents };
}
