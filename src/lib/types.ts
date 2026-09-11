// Row types mirroring saas/db/schema.sql. Money helpers live here too.

export type MembershipRole = "owner" | "admin" | "member";

export type User = {
  id: string;
  email: string;
  name: string;
  email_verified_at: string | null;
  is_platform_admin: boolean;
  created_at: string;
};

export type Studio = {
  id: string;
  slug: string;
  name: string;
  legal_name: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  brand_color: string;
  timezone: string;
  currency: string;
  custom_domain: string | null;
  custom_domain_verified_at: string | null;
  plan: string;
  plan_override: "comped" | null;
  trial_ends_at: string | null;
  read_only_since: string | null;
  grace_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_account_id: string | null;
  stripe_account_status: "none" | "pending" | "enabled" | "restricted";
  stripe_connect_method: "oauth" | "onboarding" | "manual" | "none";
  stripe_charges_enabled: boolean;
  stripe_details_submitted: boolean;
  stripe_connected_at: string | null;
  manual_payment_instructions: string | null;
  manual_payment_link: string | null;
  referral_code: string | null;
  referred_by_code: string | null;
  site_template: "editorial" | "gallery";
  site: Record<string, unknown>;
  site_draft: Record<string, unknown> | null;
  site_published_at: string | null;
  next_order_number: number;
  storage_bytes: number;
  onboarding: Record<string, boolean>;
  settings: Record<string, unknown>;
  suspended_at: string | null;
  deleted_at: string | null;
  purge_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Membership = { user_id: string; studio_id: string; role: MembershipRole; created_at: string };

export type Client = {
  id: string;
  studio_id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  notes: string | null;
  archived: boolean;
  stage: ClientStage;
  tags: string[];
  source: string | null;
  unsubscribed_at: string | null;
  last_activity_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export const clientStages = ["lead", "awaiting_payment", "booked", "proofing", "delivered", "archived"] as const;
export type ClientStage = (typeof clientStages)[number];
export const clientStageLabels: Record<ClientStage, string> = {
  lead: "New lead",
  awaiting_payment: "Awaiting payment",
  booked: "Booked",
  proofing: "Proofs out",
  delivered: "Delivered",
  archived: "Archived",
};

export type Inquiry = {
  id: string;
  studio_id: string;
  client_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  source: string | null;
  status: "new" | "read" | "archived";
  created_at: string;
};

export type Package = {
  id: string;
  studio_id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  deposit_cents: number;
  included_finals: number;
  extra_final_cents: number;
  includes: string[];
  turnaround: string | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  duration_minutes: number | null;
  bookable: boolean;
  created_at: string;
};

export const orderStatuses = [
  "draft", "pending_payment", "paid", "scheduled", "editing", "proofing", "final_delivered", "completed", "cancelled",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export const orderStatusLabels: Record<OrderStatus, string> = {
  draft: "Draft",
  pending_payment: "Awaiting payment",
  paid: "Paid",
  scheduled: "Scheduled",
  editing: "Editing",
  proofing: "Proofs sent",
  final_delivered: "Final delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type Order = {
  id: string;
  studio_id: string;
  order_number: number;
  client_id: string;
  package_id: string | null;
  title: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  status: OrderStatus;
  shoot_date: string | null;
  notes: string | null;
  deposit_cents: number;
  included_finals: number;
  extra_final_cents: number;
  contract_version: string | null;
  contract_signed_at: string | null;
  contract_signed_name: string | null;
  contract_signed_ip: string | null;
  contract_portfolio_ok: boolean | null;
  paid_at: string | null;
  scheduled_at: string | null;
  location: string | null;
  discount_cents: number;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentKind = "deposit" | "balance" | "full" | "manual";

export type Payment = {
  id: string;
  studio_id: string;
  order_id: string;
  kind: PaymentKind;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  method: string;
  stripe_account_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  refunded_cents: number;
  dispute_status: string | null;
  disputed_at: string | null;
  receipt_url: string | null;
  failure_message: string | null;
  paid_at: string | null;
  created_at: string;
};

export type PaymentStatus = "pending" | "paid" | "partially_refunded" | "refunded" | "failed" | "disputed";

export type OrderMoney = {
  price_cents: number;
  picks: number;
  extra_picks: number;
  extras_cents: number;
  total_cents: number;
  paid_cents: number;
  due_cents: number;
  deposit_cents: number;
  deposit_due_cents: number;
  deposit_paid: boolean;
  fully_paid: boolean;
};

/** Money math for a session. Refunds reduce what counts as paid; failed and disputed payments do not count. */
export function orderMoney(
  order: Pick<Order, "amount_cents" | "deposit_cents" | "included_finals" | "extra_final_cents"> & { discount_cents?: number },
  payments: (Pick<Payment, "amount_cents" | "status"> & { refunded_cents?: number })[],
  picks: number
): OrderMoney {
  const extra_picks =
    order.included_finals > 0 && order.extra_final_cents > 0 ? Math.max(0, picks - order.included_finals) : 0;
  const extras_cents = extra_picks * order.extra_final_cents;
  const total_cents = Math.max(0, order.amount_cents + extras_cents - (order.discount_cents ?? 0));
  const paid_cents = payments
    .filter((p) => p.status === "paid" || p.status === "partially_refunded" || p.status === "refunded")
    .reduce((n, p) => n + Math.max(0, p.amount_cents - (p.refunded_cents ?? 0)), 0);
  const due_cents = Math.max(0, total_cents - paid_cents);
  const deposit_cents = Math.min(order.deposit_cents, total_cents);
  return {
    price_cents: order.amount_cents,
    picks,
    extra_picks,
    extras_cents,
    total_cents,
    paid_cents,
    due_cents,
    deposit_cents,
    deposit_due_cents: Math.max(0, deposit_cents - paid_cents),
    deposit_paid: paid_cents >= deposit_cents,
    fully_paid: due_cents === 0,
  };
}

export type GalleryKind = "proof" | "final";
export type GalleryStatus = "draft" | "published" | "archived";
export const galleryKindLabels: Record<GalleryKind, string> = { proof: "Proofs", final: "Final photos" };
export const galleryStatusLabels: Record<GalleryStatus, string> = { draft: "Draft", published: "Live", archived: "Closed" };

export type Gallery = {
  id: string;
  studio_id: string;
  order_id: string | null;
  client_id: string;
  slug: string;
  title: string;
  kind: GalleryKind;
  status: GalleryStatus;
  access_code: string | null;
  allow_downloads: boolean;
  welcome_message: string | null;
  expires_at: string | null;
  source: "web" | "lightroom";
  parent_id: string | null;
  subject_name: string | null;
  password_hash: string | null;
  download_pin_hash: string | null;
  download_size: "web" | "full" | "both";
  pay_gated: boolean;
  allow_comments: boolean;
  allow_client_upload: boolean;
  allow_sharing: boolean;
  watermark: boolean;
  cover_photo_id: string | null;
  sort_mode: "manual" | "filename" | "captured";
  published_at: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
};

export type Photo = {
  id: string;
  studio_id: string;
  gallery_id: string;
  original_url: string;
  preview_url: string;
  thumb_url: string | null;
  lr_photo_id: string | null;
  filename: string;
  width: number | null;
  height: number | null;
  size_bytes: number;
  sort_order: number;
  sha256: string | null;
  uploaded_by: "studio" | "client" | "plugin";
  captured_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type PhotoComment = {
  id: string;
  studio_id: string;
  photo_id: string;
  gallery_id: string;
  author_name: string;
  author_role: "studio" | "client";
  body: string;
  resolved: boolean;
  created_at: string;
};

export type PhotoSelection = { photo_id: string; studio_id: string; gallery_id: string; selected: boolean; updated_at: string };

export type ApiToken = {
  id: string;
  studio_id: string;
  name: string;
  token_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type EmailLogRow = {
  id: string;
  studio_id: string | null;
  kind: string | null;
  to_address: string;
  subject: string;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  template_key: string | null;
  from_domain: string | null;
  related_type: string | null;
  related_id: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  created_at: string;
};

export function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatDate(value: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", opts);
}

// ---------------------------------------------------------------------------
// Store (STORE-BUILD-PLAN.md): selling portfolio images, packages and licences.
// ---------------------------------------------------------------------------

export type StoreProductKind =
  | "image" | "bundle" | "gallery_unlock" | "collection_unlock" | "gift_card" | "voucher" | "digital" | "print";
export type StoreResolution = "web" | "standard" | "original";
export type StoreLicense = "personal" | "rf" | "rm" | "extended";
export type SaleStatus = "pending" | "paid" | "failed" | "refunded" | "partially_refunded" | "disputed";
export type StorePaymentMode = "connected" | "marketplace" | "manual";

export const storeResolutionLabels: Record<StoreResolution, string> = {
  web: "Web / social",
  standard: "Standard print",
  original: "High-res original",
};
export const storeLicenseLabels: Record<StoreLicense, string> = {
  personal: "Personal / print release",
  rf: "Commercial — royalty-free",
  rm: "Commercial — rights-managed",
  extended: "Extended",
};

export type StoreCollection = {
  id: string;
  studio_id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_asset_id: string | null;
  visibility: "public" | "unlisted" | "hidden";
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type StoreCollectionItem = {
  id: string;
  studio_id: string;
  collection_id: string;
  photo_id: string | null;
  asset_id: string | null;
  sort_order: number;
  created_at: string;
};

export type StoreProduct = {
  id: string;
  studio_id: string;
  kind: StoreProductKind;
  slug: string;
  title: string;
  description: string | null;
  asset_id: string | null;
  photo_id: string | null;
  gallery_id: string | null;
  collection_id: string | null;
  license_text: string | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  seo: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProductPrice = {
  id: string;
  studio_id: string;
  product_id: string;
  resolution: StoreResolution;
  license: StoreLicense;
  amount_cents: number;
  compare_at_cents: number | null;
  min_pick: number | null;
  max_pick: number | null;
  rm_matrix: unknown | null;
  volume_tiers: unknown | null;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type PriceSheet = {
  id: string;
  studio_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type PriceSheetRow = {
  id: string;
  studio_id: string;
  sheet_id: string;
  resolution: StoreResolution;
  license: StoreLicense;
  amount_cents: number;
  min_pick: number | null;
  max_pick: number | null;
  sort_order: number;
  created_at: string;
};

export type DigitalFile = {
  id: string;
  studio_id: string;
  product_id: string;
  url: string;
  filename: string;
  content_type: string | null;
  size_bytes: number;
  created_at: string;
};

export type PrintProduct = {
  id: string;
  studio_id: string;
  product_id: string;
  lab: string | null;
  created_at: string;
};

export type PrintVariant = {
  id: string;
  studio_id: string;
  print_product_id: string;
  name: string;
  size: string | null;
  finish: string | null;
  base_cost_cents: number;
  price_cents: number;
  created_at: string;
};

export type Sale = {
  id: string;
  studio_id: string;
  order_number: number;
  buyer_email: string;
  buyer_name: string | null;
  buyer_client_id: string | null;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  status: SaleStatus;
  payment_mode: StorePaymentMode;
  discount_code: string | null;
  gift_card_id: string | null;
  gift_card_cents: number;
  stripe_account_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  refunded_cents: number;
  dispute_status: string | null;
  receipt_url: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SaleItem = {
  id: string;
  studio_id: string;
  sale_id: string;
  product_id: string | null;
  photo_id: string | null;
  asset_id: string | null;
  kind: string;
  resolution: StoreResolution;
  license: StoreLicense;
  usage_scope: Record<string, unknown>;
  qty: number;
  unit_amount_cents: number;
  amount_cents: number;
  license_document_id: string | null;
  created_at: string;
};

export type DownloadGrant = {
  id: string;
  studio_id: string;
  sale_id: string;
  sale_item_id: string | null;
  photo_id: string | null;
  file_id: string | null;
  resolution: StoreResolution;
  token_hash: string;
  expires_at: string | null;
  max_downloads: number;
  downloads_used: number;
  revoked: boolean;
  created_at: string;
};

export type DownloadEvent = {
  id: string;
  studio_id: string;
  grant_id: string;
  ip: string | null;
  ua: string | null;
  bytes: number;
  created_at: string;
};

export type DiscountCode = {
  id: string;
  studio_id: string;
  code: string;
  kind: "percent" | "fixed" | "free_ship";
  value: number;
  min_subtotal_cents: number | null;
  product_scope: string | null;
  gallery_scope: string | null;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  uses: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DiscountRedemption = {
  id: string;
  studio_id: string;
  code_id: string;
  sale_id: string;
  amount_cents: number;
  created_at: string;
};

export type GiftCard = {
  id: string;
  studio_id: string;
  code_hash: string;
  code_last4: string;
  initial_cents: number;
  balance_cents: number;
  currency: string;
  expires_at: string | null;
  is_active: boolean;
  sale_item_id: string | null;
  created_at: string;
  updated_at: string;
};

export type GiftCardTxn = {
  id: string;
  studio_id: string;
  gift_card_id: string;
  sale_id: string | null;
  delta_cents: number;
  reason: string | null;
  created_at: string;
};

export type StoreFavorite = {
  id: string;
  studio_id: string;
  buyer_key: string;
  product_id: string | null;
  photo_id: string | null;
  created_at: string;
};

export type Cart = {
  id: string;
  studio_id: string;
  buyer_email: string | null;
  items: unknown[];
  recovered_at: string | null;
  created_at: string;
  updated_at: string;
};
