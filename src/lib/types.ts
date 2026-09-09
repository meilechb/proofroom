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
  next_order_number: number;
  storage_bytes: number;
  onboarding: Record<string, boolean>;
  settings: Record<string, unknown>;
  suspended_at: string | null;
  deleted_at: string | null;
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
  status: "pending" | "paid" | "refunded";
  method: string;
  stripe_account_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
};

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

export function orderMoney(
  order: Pick<Order, "amount_cents" | "deposit_cents" | "included_finals" | "extra_final_cents">,
  payments: Pick<Payment, "amount_cents" | "status">[],
  picks: number
): OrderMoney {
  const extra_picks =
    order.included_finals > 0 && order.extra_final_cents > 0 ? Math.max(0, picks - order.included_finals) : 0;
  const extras_cents = extra_picks * order.extra_final_cents;
  const total_cents = order.amount_cents + extras_cents;
  const paid_cents = payments.filter((p) => p.status === "paid").reduce((n, p) => n + p.amount_cents, 0);
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
  created_at: string;
  updated_at: string;
};

export type Photo = {
  id: string;
  studio_id: string;
  gallery_id: string;
  original_url: string;
  preview_url: string;
  lr_photo_id: string | null;
  filename: string;
  width: number | null;
  height: number | null;
  size_bytes: number;
  sort_order: number;
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
