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

/**
 * Read a stored volume-tiers jsonb into clean {min, unitAmountCents} rows:
 * positive integer mins and non-negative cents only, deduped by min (last wins)
 * and sorted ascending. Anything malformed is dropped. Pure and client-safe.
 */
export function parseVolumeTiers(raw: unknown): VolumeTier[] {
  const arr = Array.isArray(raw) ? raw : typeof raw === "string" ? safeJsonArray(raw) : [];
  const byMin = new Map<number, number>();
  for (const row of arr) {
    if (!row || typeof row !== "object") continue;
    const r = row as { min?: unknown; unitAmountCents?: unknown };
    const min = Math.floor(Number(r.min));
    const unit = Math.round(Number(r.unitAmountCents));
    if (!Number.isFinite(min) || min < 1 || !Number.isFinite(unit) || unit < 0) continue;
    byMin.set(min, unit);
  }
  return [...byMin.entries()].map(([min, unitAmountCents]) => ({ min, unitAmountCents })).sort((a, b) => a.min - b.min);
}

function safeJsonArray(raw: string): unknown[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
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

/** Normalise a gift-card code for lookup: uppercase, keep only A–Z and 0–9. */
export function normalizeGiftCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
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

/**
 * The usage dimensions a rights-managed licence is priced on. A matrix row may
 * pin any subset of these (an unpinned dimension matches anything), so a studio
 * can price broadly ("any commercial use = $500") or finely. Buyer and admin
 * share this list so their selections line up.
 */
export const RM_DIMENSIONS = [
  { key: "usage", label: "Usage", options: [
    { value: "personal", label: "Personal" },
    { value: "editorial", label: "Editorial" },
    { value: "commercial", label: "Commercial" },
    { value: "advertising", label: "Advertising" },
  ] },
  { key: "term", label: "Term", options: [
    { value: "1y", label: "1 year" },
    { value: "3y", label: "3 years" },
    { value: "perpetual", label: "Perpetual" },
  ] },
  { key: "territory", label: "Territory", options: [
    { value: "local", label: "Local" },
    { value: "national", label: "National" },
    { value: "worldwide", label: "Worldwide" },
  ] },
] as const;

export type RmDimensionKey = (typeof RM_DIMENSIONS)[number]["key"];

function isRmOption(key: string, value: unknown): value is string {
  const dim = RM_DIMENSIONS.find((d) => d.key === key);
  return !!dim && typeof value === "string" && dim.options.some((o) => o.value === value);
}

/** Coerce stored jsonb into typed matrix rows, dropping malformed rows and unknown dimensions. */
export function parseRmMatrix(raw: unknown): RmMatrixRow[] {
  if (!Array.isArray(raw)) return [];
  const out: RmMatrixRow[] = [];
  for (const r of raw) {
    const row = r as { when?: unknown; amountCents?: unknown };
    const amount = Number(row.amountCents);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const when: RmUsage = {};
    if (row.when && typeof row.when === "object") {
      for (const d of RM_DIMENSIONS) {
        const v = (row.when as Record<string, unknown>)[d.key];
        if (isRmOption(d.key, v)) when[d.key] = v;
      }
    }
    out.push({ when, amountCents: Math.round(amount) });
  }
  return out;
}

/** Keep only recognised dimensions with valid options from a buyer's submitted scope. */
export function cleanRmUsage(raw: Record<string, unknown> | null | undefined): RmUsage {
  const usage: RmUsage = {};
  if (raw) for (const d of RM_DIMENSIONS) if (isRmOption(d.key, raw[d.key])) usage[d.key] = raw[d.key] as string;
  return usage;
}

/** True when every dimension has been chosen with a valid option. */
export function isCompleteRmUsage(usage: RmUsage): boolean {
  return RM_DIMENSIONS.every((d) => isRmOption(d.key, usage[d.key]));
}

export type EffectivePrice = { priceCents: number; compareAtCents: number | null; onSale: boolean };

/**
 * The price to charge for a row plus an optional struck-through "compare at".
 * `amount_cents` is the sale price and `compare_at_cents` the higher "was"
 * price. With no window a compare-at is a standing sale. With a window, inside
 * it the sale price applies and the was-price is struck through; outside it the
 * regular (compare-at) price is charged and nothing is struck through.
 */
export function effectivePrice(
  row: Pick<ProductPrice, "amount_cents" | "compare_at_cents" | "sale_starts_at" | "sale_ends_at">,
  now: Date = new Date()
): EffectivePrice {
  const compare = row.compare_at_cents;
  const hasWindow = row.sale_starts_at != null || row.sale_ends_at != null;
  const inWindow = (!row.sale_starts_at || new Date(row.sale_starts_at) <= now) && (!row.sale_ends_at || new Date(row.sale_ends_at) >= now);
  if (compare != null && compare > 0) {
    if (!hasWindow || inWindow) {
      const onSale = compare > row.amount_cents;
      return { priceCents: row.amount_cents, compareAtCents: onSale ? compare : null, onSale };
    }
    return { priceCents: compare, compareAtCents: null, onSale: false }; // outside the window → regular price
  }
  return { priceCents: row.amount_cents, compareAtCents: null, onSale: false };
}

export type PriceResolution = { amountCents: number } | { quote: true } | null;

/**
 * The authoritative price for a (resolution, licence) option — used by both the
 * storefront preview and the server-side checkout so they always agree.
 * `null` = not for sale. `{quote:true}` = priced on request (a rights-managed
 * row whose matrix has no line for the chosen usage, or an incomplete usage).
 * For a rights-managed row WITH a matrix, the price comes from the matrix; with
 * no matrix it is a flat `amount_cents` and the usage is just recorded.
 */
export function resolveStorePrice(
  prices: Pick<ProductPrice, "resolution" | "license" | "amount_cents" | "compare_at_cents" | "sale_starts_at" | "sale_ends_at" | "is_active" | "rm_matrix">[],
  resolution: StoreResolution,
  license: StoreLicense,
  usage?: RmUsage,
  now: Date = new Date()
): PriceResolution {
  const row = prices.find((p) => p.is_active && p.resolution === resolution && p.license === license);
  if (!row) return null;
  if (license === "rm") {
    const matrix = parseRmMatrix(row.rm_matrix);
    if (matrix.length > 0) {
      const u = cleanRmUsage(usage ?? {});
      const priced = rmPrice(u, matrix);
      return isCompleteRmUsage(u) && priced != null ? { amountCents: priced } : { quote: true };
    }
    const flat = effectivePrice(row, now).priceCents;
    return flat > 0 ? { amountCents: flat } : { quote: true };
  }
  const eff = effectivePrice(row, now).priceCents;
  return eff > 0 ? { amountCents: eff } : null;
}

// --- Digital products (S21) -------------------------------------------------

/** Ceiling for a single sold file (presets, LUTs, e-books, bundles). */
export const MAX_DIGITAL_BYTES = 500 * 1024 * 1024;

/**
 * File kinds a studio may sell as a download. Validation is by extension, not
 * MIME: browsers report these inconsistently (a `.cube` LUT or `.xmp` preset is
 * usually `application/octet-stream` or empty), so the extension is the reliable
 * gate. Shared so the admin uploader's `accept` and the server agree.
 */
export const DIGITAL_EXTENSIONS = [
  "zip", "pdf", "epub", "mobi",
  "xmp", "lrtemplate", "dng", "dcp",
  "cube", "3dl", "look",
  "atn", "acv", "csv", "txt",
];

export const DIGITAL_ACCEPT = DIGITAL_EXTENSIONS.map((e) => `.${e}`).join(",");

/** True when a filename's extension is one we allow as a digital download. */
export function digitalExtOk(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return filename.includes(".") && DIGITAL_EXTENSIONS.includes(ext);
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
